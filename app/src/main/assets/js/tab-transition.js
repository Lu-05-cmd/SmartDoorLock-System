(function initTabViews() {
  const assetsBaseUrl = new URL(
    '../',
    document.currentScript?.src || document.baseURI
  );
  const main = document.querySelector('.app-page-content');
  if (!main) return;

  const views = new Map([['home', Array.from(main.childNodes)]]);
  const initializedViews = new Set(['home']);
  const tabLinks = Array.from(document.querySelectorAll('nav a[data-path]'));
  const navItems = document.querySelector('.app-bottom-nav-items');
  const navIndicator = navItems?.querySelector('.app-bottom-nav-indicator');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabTransitionDuration = 180;
  const tabTransitionEasing = 'ease-out';
  let currentTab = 'home';
  let loadingView = false;

  function animateTabContent(direction, phase) {
    if (reducedMotion.matches || typeof main.animate !== 'function') {
      return Promise.resolve();
    }
    const offset = direction * 20;
    const keyframes = phase === 'exit'
      ? [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${-offset}px)` }
      ]
      : [
        { opacity: 0, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: 'translateX(0)' }
      ];
    return main.animate(keyframes, {
      duration: tabTransitionDuration,
      easing: tabTransitionEasing,
      fill: 'both'
    }).finished;
  }

  function updateTabContent(tab, nodes) {
    if (currentTab === 'faces' && typeof window.pauseFacesView === 'function') {
      window.pauseFacesView();
    }
    main.replaceChildren(...nodes);
    document.body.classList.toggle('activity-page', tab === 'activity');
    document.body.classList.toggle('faces-page', tab === 'faces');
    document.body.classList.toggle('settings-page', tab === 'settings');
    currentTab = tab;
    updateNavigation(tab);
    if (tab === 'settings') {
      document.documentElement.classList.remove('startup-settings');
    }

    const initializer = window[`init${tab[0].toUpperCase()}${tab.slice(1)}View`];
    if (tab === 'home' && typeof initializer === 'function') {
      initializer();
    } else if (!initializedViews.has(tab) && typeof initializer === 'function') {
      initializer();
      initializedViews.add(tab);
    } else if (tab === 'faces' && typeof initializer === 'function') {
      initializer();
    }
  }

  function moveNavigationIndicator(activeLink) {
    if (!navItems || !navIndicator || !activeLink) return;
    const width = Math.min(88, Math.max(56, activeLink.clientWidth - 12));
    const left = activeLink.offsetLeft + (activeLink.offsetWidth - width) / 2;
    navIndicator.style.width = `${width}px`;
    navIndicator.style.transform = `translate(${left}px, -50%)`;
  }

  function updateNavigation(activeTab) {
    tabLinks.forEach(link => {
      const isActive = link.dataset.path === activeTab;
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }

      link.classList.toggle('text-primary', isActive);
      link.classList.toggle('font-semibold', isActive);
      link.classList.toggle('text-on-surface-variant', !isActive);

      const icon = link.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
      }
    });
    moveNavigationIndicator(tabLinks.find(link => link.dataset.path === activeTab));
  }

  async function loadTabView(tab) {
    if (views.has(tab)) return views.get(tab);

    const response = await fetch(
      new URL(`${tab}.html`, assetsBaseUrl),
      { cache: 'no-cache' }
    );
    if (!response.ok) {
      throw new Error(`Could not load ${tab} (${response.status})`);
    }

    const documentTemplate = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const activityMain = documentTemplate.querySelector('.app-page-content');
    if (!activityMain) throw new Error(`${tab} page content is missing.`);

    const nodes = Array.from(activityMain.childNodes)
      .filter(node => !(node.nodeType === Node.ELEMENT_NODE && node.matches('script')))
      .map(node => document.importNode(node, true));
    views.set(tab, nodes);
    return nodes;
  }

  async function showTab(tab) {
    if (!['home', 'activity', 'faces', 'settings'].includes(tab)
        || tab === currentTab
        || loadingView) return;

    loadingView = true;
    try {
      const nodes = await loadTabView(tab);
      document.getElementById('tab-load-error')?.remove();
      const currentIndex = tabLinks.findIndex(link => link.dataset.path === currentTab);
      const nextIndex = tabLinks.findIndex(link => link.dataset.path === tab);
      const direction = nextIndex >= currentIndex ? 1 : -1;
      const reducedMotionEnabled = reducedMotion.matches;
      const transition = document.startViewTransition;
      if (!reducedMotionEnabled && typeof transition === 'function') {
        document.documentElement.classList.toggle('tab-transition-forward', direction > 0);
        document.documentElement.classList.toggle('tab-transition-backward', direction < 0);
        try {
          await transition.call(document, () => updateTabContent(tab, nodes)).finished;
        } finally {
          document.documentElement.classList.remove(
            'tab-transition-forward',
            'tab-transition-backward'
          );
        }
      } else {
        try {
          await animateTabContent(direction, 'exit');
        } finally {
          main.getAnimations().forEach(animation => animation.cancel());
        }
        updateTabContent(tab, nodes);
        await animateTabContent(direction, 'enter');
        main.getAnimations().forEach(animation => animation.cancel());
      }
    } catch (error) {
      console.error(error);
      main.getAnimations().forEach(animation => animation.cancel());
      document.documentElement.classList.remove(
        'tab-transition-forward',
        'tab-transition-backward'
      );
      document.documentElement.classList.remove('startup-settings');
      let errorMessage = document.getElementById('tab-load-error');
      if (!errorMessage) {
        errorMessage = document.createElement('p');
        errorMessage.id = 'tab-load-error';
        errorMessage.className = 'text-error text-body-sm py-3';
        errorMessage.setAttribute('role', 'alert');
        main.prepend(errorMessage);
      }
      errorMessage.textContent = `Không thể tải tab "${tab}": ${error.message}`;
    } finally {
      loadingView = false;
    }
  }

  tabLinks.forEach(link => {
    link.addEventListener('click', event => {
      const tab = link.dataset.path;
      if (!['home', 'activity', 'faces', 'settings'].includes(tab)) return;

      event.preventDefault();
      showTab(tab);
    });
  });

  const initiallyActiveLink = tabLinks.find(link => link.getAttribute('aria-current') === 'page');
  if (initiallyActiveLink) moveNavigationIndicator(initiallyActiveLink);
  window.addEventListener('resize', () => {
    const activeLink = tabLinks.find(link => link.getAttribute('aria-current') === 'page');
    moveNavigationIndicator(activeLink);
  });

  const initialTab = window.location.hash.slice(1);
  if (['activity', 'faces', 'settings'].includes(initialTab)) {
    showTab(initialTab);
  }
})();

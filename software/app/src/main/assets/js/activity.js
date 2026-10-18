window.initActivityView = function initActivityView() {
  const chips = document.querySelectorAll('.filter-chip');
  const cards = document.querySelectorAll('.event-card');
  const emptyState = document.getElementById('noEventsState');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(item => {
        item.classList.remove('bg-primary', 'text-on-primary');
        item.classList.add('bg-surface-container-lowest', 'text-secondary');
      });
      chip.classList.remove('bg-surface-container-lowest', 'text-secondary');
      chip.classList.add('bg-primary', 'text-on-primary');

      const filter = chip.getAttribute('data-filter');
      let visibleCount = 0;

      cards.forEach(card => {
        const matches = filter === 'all'
          || (filter === 'alerts' && card.dataset.category === 'alerts')
          || card.dataset.door === filter;
        card.classList.toggle('hidden', !matches);
        if (matches) visibleCount++;
      });

      emptyState.classList.toggle('hidden', visibleCount > 0);
      emptyState.classList.toggle('flex', visibleCount === 0);
    });
  });

  document.querySelector('.snapshot-review')?.addEventListener('click', event => {
    event.currentTarget.textContent = 'Viewed';
  });
};

if (document.body.classList.contains('activity-page')) {
  window.initActivityView();
}

function switchFaceTab(tab){
    const tabSaved=document.getElementById('tab-saved-faces');
    const tabDeleted=document.getElementById('tab-deleted-faces');
    const carouselWrapper=document.querySelector('#face-carousel')?.parentElement;
    const dotsWrapper=document.querySelector('.carousel-dot')?.parentElement;
    const deletedView=document.getElementById('view-deleted-faces');
    const carouselHint=document.getElementById('saved-carousel-hint');
    const deletedHeader=document.getElementById('deleted-actions-header');
    if(tab==='saved'){
        tabSaved.classList.add('bg-surface-container-lowest','text-on-surface','shadow-sm','font-semibold');
        tabSaved.classList.remove('text-on-surface-variant');tabDeleted.classList.remove('bg-surface-container-lowest','text-on-surface','shadow-sm','font-semibold');
        tabDeleted.classList.add('text-on-surface-variant');if(carouselWrapper)carouselWrapper.classList.remove('hidden');
        if(dotsWrapper)dotsWrapper.classList.remove('hidden');
        if(deletedView)deletedView.classList.add('hidden');
        if(carouselHint)carouselHint.classList.remove('hidden');
        if(deletedHeader)deletedHeader.classList.add('hidden');
    }else{
        tabDeleted.classList.add('bg-surface-container-lowest','text-on-surface','shadow-sm','font-semibold');
        tabDeleted.classList.remove('text-on-surface-variant');
            tabSaved.classList.remove('bg-surface-container-lowest','text-on-surface','shadow-sm','font-semibold');
            tabSaved.classList.add('text-on-surface-variant');
            if(carouselWrapper)carouselWrapper.classList.add('hidden');
            if(dotsWrapper)dotsWrapper.classList.add('hidden');
            if(deletedView)deletedView.classList.remove('hidden');
            if(carouselHint)carouselHint.classList.add('hidden');
            if(deletedHeader)deletedHeader.classList.remove('hidden');
        }
    }
    let targetDeleteName='';
    function openDeleteConfirmModal(name,role){
        targetDeleteName=name;
        document.getElementById('delete-modal-user-name').textContent=name+(role?' ('+role+')':'');
        document.getElementById('delete-confirm-modal').classList.remove('hidden');
    }
    function closeDeleteConfirmModal(){
        document.getElementById('delete-confirm-modal').classList.add('hidden');
    }
    function executeMoveToTrash(){
        closeDeleteConfirmModal();
        switchFaceTab('deleted');
    }
    function openEmptyTrashModal(){
        document.getElementById('permanent-modal-title').textContent='Dọn sạch thùng rác?';
        document.getElementById('permanent-modal-desc').textContent='Toàn bộ khuôn mặt đã xóa (2 mẫu) sẽ bị giải phóng hoàn toàn khỏi bộ nhớ Flash ESP32 (tiết kiệm 40% dung lượng Flash ROM).';
        document.getElementById('permanent-delete-modal').classList.remove('hidden');
    }
    function confirmPermanentDelete(name){
        document.getElementById('permanent-modal-title').textContent='Xóa vĩnh viễn '+name+'?';
        document.getElementById('permanent-modal-desc').textContent='Mẫu khuôn mặt này sẽ bị hủy bỏ vĩnh viễn khỏi ESP32 Flash và máy chủ. Bạn sẽ cần quét lại từ đầu nếu muốn cấp quyền lại.';
        document.getElementById('permanent-delete-modal').classList.remove('hidden');
    }
    function closePermanentModal(){
        document.getElementById('permanent-delete-modal').classList.add('hidden');
    }
    function executePermanentDelete(){
        closePermanentModal();
    }
    function restoreFace(name){
        alert('Đã khôi phục thành công '+name+' và nạp lại vào bộ nhớ ESP32!');
        switchFaceTab('saved');
    }

document.querySelector('.group-table').addEventListener('click', event => {
  if (!event.target.closest('.expand-button')) return;
  event.preventDefault();
  event.target.closest('tr').nextElementSibling.classList.toggle('hidden');
});

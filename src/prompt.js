const input = document.getElementById('v');

window.eingabe.onAsk(({ label, hint, value, password }) => {
  document.getElementById('label').textContent = label;
  document.getElementById('hint').textContent = hint || '';
  input.type = password ? 'password' : 'text';
  input.value = value || '';
  input.focus();
  input.select();
});

document.getElementById('f').addEventListener('submit', (e) => {
  e.preventDefault();
  window.eingabe.answer(input.value);
});
document.getElementById('cancel').addEventListener('click', () => window.eingabe.answer(null));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.eingabe.answer(null); });

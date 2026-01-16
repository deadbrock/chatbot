/**
 * FIX EMERGENCIAL: Remove bloqueios de interação
 * Execute no Console se a página estiver travada
 */

// Remover todos os backdrops do modal
document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

// Remover classes que bloqueiam scroll
document.body.classList.remove('modal-open');
document.body.style.overflow = '';
document.body.style.paddingRight = '';

// Fechar todos os modais abertos
document.querySelectorAll('.modal.show').forEach(modal => {
  modal.classList.remove('show');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
});

console.log('✅ Fix aplicado! Tente interagir agora.');

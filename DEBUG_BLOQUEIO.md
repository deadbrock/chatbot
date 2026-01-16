# DEBUG: Página Travada - Diagnóstico Completo

## Execute no Console (F12):

### 1. Verificar o que está bloqueando:

```javascript
// Encontrar elementos com z-index alto
const highZ = Array.from(document.querySelectorAll('*')).filter(el => {
  const z = window.getComputedStyle(el).zIndex;
  return z !== 'auto' && parseInt(z) > 1000;
}).map(el => ({
  elemento: el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className}` : ''),
  zIndex: window.getComputedStyle(el).zIndex,
  position: window.getComputedStyle(el).position,
  size: `${el.offsetWidth}x${el.offsetHeight}`
}));
console.table(highZ);
```

### 2. Testar se cliques estão chegando:

```javascript
// Adicionar listener de debug
let clickCount = 0;
document.body.addEventListener('click', (e) => {
  clickCount++;
  console.log(`✅ CLIQUE #${clickCount} em:`, e.target);
}, { capture: true });
console.log('👆 Agora clique em qualquer lugar da página...');
```

### 3. Forçar fechamento do modal:

```javascript
// Fechar TODOS os modais de forma agressiva
const modals = document.querySelectorAll('.modal');
modals.forEach((modal, i) => {
  console.log(`🔴 Removendo modal #${i}:`, modal.id);
  modal.remove();
});

// Remover backdrops
document.querySelectorAll('.modal-backdrop').forEach(el => {
  console.log('🔴 Removendo backdrop');
  el.remove();
});

// Limpar body
document.body.className = document.body.className.replace(/modal-\w+/g, '');
document.body.style = '';

console.log('✅ Modais removidos! Página deve estar liberada.');
```

### 4. Verificar se há event stoppers:

```javascript
// Detectar se alguém está parando propagação
const original = Event.prototype.stopPropagation;
Event.prototype.stopPropagation = function() {
  console.warn('⚠️ stopPropagation chamado!', this.type, this.target);
  return original.apply(this, arguments);
};
console.log('👀 Monitorando stopPropagation...');
```

## Resultados Esperados:

- **Teste 1**: Deve mostrar uma tabela com elementos que têm z-index alto
- **Teste 2**: Deve mostrar "✅ CLIQUE #1..." quando você clicar
- **Teste 3**: Deve remover o modal e liberar a página
- **Teste 4**: Deve avisar se algo está bloqueando eventos

## Se NADA funcionar:

Recarregue a página e **NÃO clique em "Campanhas"**. Me avise e vou desabilitar temporariamente esse módulo.

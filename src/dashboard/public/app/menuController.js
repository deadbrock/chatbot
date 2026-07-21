/**
 * Menu Controller - Controla o comportamento do menu cascata
 */

export function syncSidebarSubmenu(activeSection) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.querySelectorAll('.nav-dropdown-toggle').forEach((toggle) => {
    toggle.classList.remove('has-active-child');
  });

  const activeLink = activeSection
    ? sidebar.querySelector(`.nav-link[data-section="${activeSection}"]`)
    : sidebar.querySelector('.nav-submenu .nav-link.active');

  if (!activeLink) {
    sidebar.querySelectorAll('.nav-item.has-submenu.open').forEach((item) => {
      item.classList.remove('open');
    });
    return;
  }

  const parentItem = activeLink.closest('.nav-item.has-submenu');

  sidebar.querySelectorAll('.nav-item.has-submenu.open').forEach((item) => {
    if (item !== parentItem) {
      item.classList.remove('open');
    }
  });

  if (!parentItem) return;

  parentItem.classList.add('open');
  parentItem.querySelector('.nav-dropdown-toggle')?.classList.add('has-active-child');
}

export function initMenuController() {
  const sidebar = document.getElementById('sidebar');
  
  if (!sidebar) return;

  // Gerenciar cliques nos dropdowns
  const dropdownToggles = sidebar.querySelectorAll('.nav-dropdown-toggle');
  
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      
      const parentItem = toggle.closest('.nav-item.has-submenu');
      
      if (!parentItem) return;

      // Verificar se já está aberto
      const isOpen = parentItem.classList.contains('open');
      
      // Fechar todos os outros submenus
      sidebar.querySelectorAll('.nav-item.has-submenu.open').forEach(item => {
        if (item !== parentItem) {
          item.classList.remove('open');
        }
      });
      
      // Toggle do submenu atual
      if (isOpen) {
        parentItem.classList.remove('open');
      } else {
        parentItem.classList.add('open');
      }
    });
  });

  // Gerenciar cliques nos links do submenu
  const submenuLinks = sidebar.querySelectorAll('.nav-submenu .nav-link');
  
  submenuLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remover active de todos os links
      sidebar.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
      });
      
      // Adicionar active no link clicado
      link.classList.add('active');
      
      syncSidebarSubmenu(link.getAttribute('data-section'));
    });
  });

  // Gerenciar cliques nos links principais (sem submenu)
  const mainLinks = sidebar.querySelectorAll('.nav-item:not(.has-submenu) > .nav-link');
  
  mainLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remover active de todos os links
      sidebar.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
      });
      
      // Adicionar active no link clicado
      link.classList.add('active');
      
      // Fechar todos os submenus
      sidebar.querySelectorAll('.nav-item.has-submenu.open').forEach(item => {
        item.classList.remove('open');
      });

      sidebar.querySelectorAll('.nav-dropdown-toggle').forEach((toggle) => {
        toggle.classList.remove('has-active-child');
      });
    });
  });

  // Abrir automaticamente o submenu se houver um item ativo dentro dele
  const activeSubmenuLink = sidebar.querySelector('.nav-submenu .nav-link.active');
  if (activeSubmenuLink) {
    syncSidebarSubmenu(activeSubmenuLink.getAttribute('data-section'));
  }
}

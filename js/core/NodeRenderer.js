// NodeRenderer - Reusable rendering utilities for nodes
export class NodeRenderer {
  /**
   * Create a grid layout of items
   */
  static grid(items, options = {}) {
    const { onClick, columns = 2 } = options;

    const gridDiv = document.createElement('div');
    gridDiv.className = 'node-grid';
    if (columns) {
      gridDiv.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    }

    items.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'node-item';
      itemDiv.textContent = item.label || item;

      if (onClick) {
        itemDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(item, index);
        });
      }

      gridDiv.appendChild(itemDiv);
    });

    return gridDiv;
  }

  /**
   * Create a list layout with thumbnails
   */
  static list(items, options = {}) {
    const { onClick, selectedIndex } = options;

    const listDiv = document.createElement('div');
    listDiv.className = 'node-list';

    items.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'node-list-item';
      if (index === selectedIndex) {
        itemDiv.classList.add('selected');
      }

      if (item.path) {
        const img = document.createElement('img');
        img.src = item.path;
        img.alt = item.title || '';
        img.className = 'item-thumbnail';
        itemDiv.appendChild(img);
      }

      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = item.title || item.label || item;
      itemDiv.appendChild(title);

      if (onClick) {
        itemDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick(item, index);
        });
      }

      listDiv.appendChild(itemDiv);
    });

    return listDiv;
  }

  /**
   * Create a header with back button
   */
  static header(options = {}) {
    const { onBack, showShuffle, onShuffle } = options;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'node-header';

    if (onBack) {
      const backBtn = document.createElement('button');
      backBtn.className = 'back-btn';
      backBtn.textContent = '←';
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onBack();
      });
      headerDiv.appendChild(backBtn);
    }

    if (showShuffle && onShuffle) {
      const shuffleBtn = document.createElement('button');
      shuffleBtn.className = 'shuffle-btn';
      shuffleBtn.textContent = '⚄';
      shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onShuffle();
      });
      headerDiv.appendChild(shuffleBtn);
    }

    return headerDiv;
  }

  /**
   * Create an empty state message
   */
  static empty(message) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'node-empty';
    emptyDiv.textContent = message;
    return emptyDiv;
  }

  /**
   * Create a loading state message
   */
  static loading(message = 'Loading...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'node-loading';
    loadingDiv.textContent = message;
    return loadingDiv;
  }

  /**
   * Clear and set content
   */
  static setContent(element, ...children) {
    element.innerHTML = '';
    children.forEach(child => {
      if (typeof child === 'string') {
        element.innerHTML += child;
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });
  }
}

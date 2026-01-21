/**
 * Tab Modules Index
 *
 * Re-exports all tab modules for convenient importing.
 */

export { initMixTab, renderUnitRows, updateTotalMix, setMarkInputChanged as setMixMarkInputChanged } from './mix-tab';
export { initDimTab, updateDimensionsFromBuilding, setMarkInputChanged as setDimMarkInputChanged } from './dim-tab';
export { initEgressTab, setMarkInputChanged as setEgressMarkInputChanged } from './egress-tab';

/**
 * Initialize tab switching behavior.
 *
 * @param tabs - NodeList of tab button elements
 * @param tabContents - NodeList of tab content elements
 */
export function initTabSwitching(tabs: NodeListOf<Element>, tabContents: NodeListOf<Element>): void {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${tabId}`) {
          content.classList.add('active');
        }
      });
    });
  });
}

import { Slider } from '../components/Slider';

export class HSLPanel {
  constructor(container, editState) {
    this.container = container;
    this.editState = editState;
    this.activeTab = 's'; // 'h' (Hue), 's' (Saturation), 'l' (Luminance)
    this.sliders = {};
    
    this.channels = [
      { key: 'red', label: 'Red', class: 'red' },
      { key: 'orange', label: 'Orange', class: 'orange' },
      { key: 'yellow', label: 'Yellow', class: 'yellow' },
      { key: 'green', label: 'Green', class: 'green' },
      { key: 'aqua', label: 'Aqua', class: 'aqua' },
      { key: 'blue', label: 'Blue', class: 'blue' },
      { key: 'purple', label: 'Purple', class: 'purple' },
      { key: 'magenta', label: 'Magenta', class: 'magenta' }
    ];

    this.init();
    
    this.unsubscribe = this.editState.onChange((state) => this.syncSliders(state));
  }

  init() {
    this.container.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '12px';

    // Sub-Tabs Selector
    const tabs = document.createElement('div');
    tabs.className = 'hsl-tabs';

    const tabConfig = [
      { key: 'h', label: 'Hue' },
      { key: 's', label: 'Saturation' },
      { key: 'l', label: 'Luminance' }
    ];

    tabConfig.forEach(t => {
      const tab = document.createElement('div');
      tab.className = `hsl-tab ${t.key === this.activeTab ? 'active' : ''}`;
      tab.textContent = t.label;
      tab.addEventListener('click', () => {
        document.querySelectorAll('.hsl-tab').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = t.key;
        this.buildSliders(panel.querySelector('.hsl-sliders-list'));
      });
      tabs.appendChild(tab);
    });

    panel.appendChild(tabs);

    // Container for sliders list
    const slidersList = document.createElement('div');
    slidersList.className = 'hsl-sliders-list';
    panel.appendChild(slidersList);

    this.container.appendChild(panel);

    // Initial build
    this.buildSliders(slidersList);
  }

  // Build the 8 slider inputs for the active tab (H, S, or L)
  buildSliders(container) {
    container.innerHTML = '';
    this.sliders = {};

    const range = this.activeTab === 'h' ? 180 : 100; // Hue shifts are +/- 180, others +/- 100
    const step = 1;

    this.channels.forEach(ch => {
      // Create slider container wrapper to apply CSS track styling (.hsl-slider-red etc)
      const wrap = document.createElement('div');
      wrap.className = `hsl-slider-${ch.class}`;

      const slider = new Slider({
        label: ch.label,
        min: -range,
        max: range,
        step: step,
        defaultValue: 0,
        onChange: (val) => {
          // Set nested property: e.g. hsl.red.h = val
          const state = this.editState.get().hsl[ch.key];
          this.editState.set(`hsl.${ch.key}.${this.activeTab}`, val);
        }
      });

      this.sliders[ch.key] = slider;
      wrap.appendChild(slider.element);
      container.appendChild(wrap);
    });

    this.syncSliders(this.editState.get());
  }

  // Update slider positions when the central state changes
  syncSliders(state) {
    if (!this.sliders) return;

    this.channels.forEach(ch => {
      const slider = this.sliders[ch.key];
      if (slider) {
        const val = state.hsl[ch.key][this.activeTab];
        slider.setValue(val);
      }
    });
  }

  destroy() {
    this.unsubscribe();
  }
}

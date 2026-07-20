export class Slider {
  constructor(options = {}) {
    this.label = options.label || '';
    this.min = options.min !== undefined ? options.min : 0;
    this.max = options.max !== undefined ? options.max : 100;
    this.step = options.step !== undefined ? options.step : 1;
    this.defaultValue = options.defaultValue !== undefined ? options.defaultValue : 0;
    this.value = options.value !== undefined ? options.value : this.defaultValue;
    this.onChange = options.onChange || null;
    this.isBipolar = this.min < 0; // centered slider like exposure +/- 5
    
    this.element = this._create();
    this.updateTrackFill();
  }

  // Create DOM nodes
  _create() {
    const group = document.createElement('div');
    group.className = 'slider-group';

    // Label row
    const labelRow = document.createElement('div');
    labelRow.className = 'slider-label-row';
    
    const label = document.createElement('span');
    label.className = 'slider-label';
    label.textContent = this.label;
    labelRow.appendChild(label);

    const valDisplay = document.createElement('span');
    valDisplay.className = 'slider-value';
    valDisplay.textContent = this._formatValue(this.value);
    labelRow.appendChild(valDisplay);
    
    group.appendChild(labelRow);

    // Input slider
    const wrapper = document.createElement('div');
    wrapper.className = 'slider-wrapper';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'custom-slider';
    input.min = this.min;
    input.max = this.max;
    input.step = this.step;
    input.value = this.value;
    
    wrapper.appendChild(input);
    group.appendChild(wrapper);

    // Event listeners
    input.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      
      this.value = val;
      valDisplay.textContent = this._formatValue(this.value);
      this.updateTrackFill();
      
      if (this.onChange) this.onChange(this.value);
    });

    // Double click input or label to reset
    input.addEventListener('dblclick', () => this.reset());
    labelRow.addEventListener('dblclick', () => this.reset());

    // Support double-tap to reset on touch screens
    let lastTap = 0;
    labelRow.addEventListener('touchstart', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        this.reset();
        e.preventDefault();
      }
      lastTap = now;
    }, { passive: false });

    this.input = input;
    this.valDisplay = valDisplay;

    return group;
  }

  // Set new slider value
  setValue(val) {
    this.value = val;
    this.input.value = val;
    this.valDisplay.textContent = this._formatValue(val);
    this.updateTrackFill();
  }

  // Reset to default
  reset() {
    this.setValue(this.defaultValue);
    if (this.onChange) this.onChange(this.defaultValue);
  }

  // Color fill track from center (bipolar) or left (unipolar)
  updateTrackFill() {
    const min = this.min;
    const max = this.max;
    const val = this.value;
    
    // Percentage from left edge
    const pct = ((val - min) / (max - min)) * 100;
    
    let bg = '';
    if (this.isBipolar) {
      // Bipolar (fill from 50% to current value)
      if (pct < 50) {
        bg = `linear-gradient(to right, 
          var(--bg-primary) 0%, 
          var(--bg-primary) ${pct}%, 
          var(--accent-color) ${pct}%, 
          var(--accent-color) 50%, 
          var(--bg-primary) 50%, 
          var(--bg-primary) 100%)`;
      } else {
        bg = `linear-gradient(to right, 
          var(--bg-primary) 0%, 
          var(--bg-primary) 50%, 
          var(--accent-color) 50%, 
          var(--accent-color) ${pct}%, 
          var(--bg-primary) ${pct}%, 
          var(--bg-primary) 100%)`;
      }
    } else {
      // Unipolar (fill from 0% to current value)
      bg = `linear-gradient(to right, 
        var(--accent-color) 0%, 
        var(--accent-color) ${pct}%, 
        var(--bg-primary) ${pct}%, 
        var(--bg-primary) 100%)`;
    }
    
    this.input.style.background = bg;
  }

  _formatValue(val) {
    if (this.isBipolar && val > 0) return `+${val.toFixed(this.step % 1 === 0 ? 0 : 2)}`;
    return val.toFixed(this.step % 1 === 0 ? 0 : 2);
  }
}

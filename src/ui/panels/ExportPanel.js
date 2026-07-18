import { Slider } from '../components/Slider';

export class ExportPanel {
  constructor(container, onExportCallback) {
    this.container = container;
    this.onExport = onExportCallback;
    this.format = 'image/jpeg';
    this.quality = 92;
    this.scale = 1.0; // 1.0 = original, 0.5 = half size
    
    this.init();
  }

  init() {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '16px';

    // Format Selector
    const formatGroup = document.createElement('div');
    formatGroup.style.display = 'flex';
    formatGroup.style.flexDirection = 'column';
    formatGroup.style.gap = '6px';

    const label = document.createElement('span');
    label.textContent = 'Format';
    label.style.fontSize = 'var(--font-size-xs)';
    label.style.color = 'var(--text-secondary)';
    formatGroup.appendChild(label);

    const toggleWrapper = document.createElement('div');
    toggleWrapper.style.display = 'flex';
    toggleWrapper.style.border = '1px solid var(--border-color)';
    toggleWrapper.style.borderRadius = 'var(--radius-sm)';
    toggleWrapper.style.overflow = 'hidden';

    const jpegBtn = document.createElement('div');
    jpegBtn.className = 'hsl-tab active'; // reuse tab class
    jpegBtn.textContent = 'JPEG';
    jpegBtn.style.textAlign = 'center';
    jpegBtn.style.padding = '8px';
    jpegBtn.style.cursor = 'pointer';
    jpegBtn.style.flex = '1';

    const pngBtn = document.createElement('div');
    pngBtn.className = 'hsl-tab';
    pngBtn.textContent = 'PNG';
    pngBtn.style.textAlign = 'center';
    pngBtn.style.padding = '8px';
    pngBtn.style.cursor = 'pointer';
    pngBtn.style.flex = '1';

    jpegBtn.addEventListener('click', () => {
      jpegBtn.classList.add('active');
      pngBtn.classList.remove('active');
      this.format = 'image/jpeg';
      qualitySliderContainer.style.display = 'block';
    });

    pngBtn.addEventListener('click', () => {
      pngBtn.classList.add('active');
      jpegBtn.classList.remove('active');
      this.format = 'image/png';
      qualitySliderContainer.style.display = 'none';
    });

    toggleWrapper.appendChild(jpegBtn);
    toggleWrapper.appendChild(pngBtn);
    formatGroup.appendChild(toggleWrapper);
    panel.appendChild(formatGroup);

    // Quality Slider (Container so we can hide/show)
    const qualitySliderContainer = document.createElement('div');
    
    this.qualitySlider = new Slider({
      label: 'Compression Quality',
      min: 10,
      max: 100,
      defaultValue: 92,
      onChange: (val) => {
        this.quality = val;
      }
    });
    
    qualitySliderContainer.appendChild(this.qualitySlider.element);
    panel.appendChild(qualitySliderContainer);

    // Dimension Selector
    const dimGroup = document.createElement('div');
    dimGroup.style.display = 'flex';
    dimGroup.style.flexDirection = 'column';
    dimGroup.style.gap = '6px';

    const dimLabel = document.createElement('span');
    dimLabel.textContent = 'Resize dimensions';
    dimLabel.style.fontSize = 'var(--font-size-xs)';
    dimLabel.style.color = 'var(--text-secondary)';
    dimGroup.appendChild(dimLabel);

    const dimToggle = document.createElement('div');
    dimToggle.style.display = 'flex';
    dimToggle.style.border = '1px solid var(--border-color)';
    dimToggle.style.borderRadius = 'var(--radius-sm)';
    dimToggle.style.overflow = 'hidden';

    const fullBtn = document.createElement('div');
    fullBtn.className = 'hsl-tab active';
    fullBtn.textContent = 'Original Size';
    fullBtn.style.textAlign = 'center';
    fullBtn.style.padding = '8px';
    fullBtn.style.cursor = 'pointer';
    fullBtn.style.flex = '1';

    const halfBtn = document.createElement('div');
    halfBtn.className = 'hsl-tab';
    halfBtn.textContent = '50% Smaller';
    halfBtn.style.textAlign = 'center';
    halfBtn.style.padding = '8px';
    halfBtn.style.cursor = 'pointer';
    halfBtn.style.flex = '1';

    fullBtn.addEventListener('click', () => {
      fullBtn.classList.add('active');
      halfBtn.classList.remove('active');
      this.scale = 1.0;
    });

    halfBtn.addEventListener('click', () => {
      halfBtn.classList.add('active');
      fullBtn.classList.remove('active');
      this.scale = 0.5;
    });

    dimToggle.appendChild(fullBtn);
    dimToggle.appendChild(halfBtn);
    dimGroup.appendChild(dimToggle);
    panel.appendChild(dimGroup);

    // Export Trigger Button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-primary';
    exportBtn.style.width = '100%';
    exportBtn.style.padding = '12px';
    exportBtn.style.justifyContent = 'center';
    exportBtn.innerHTML = '💾 Download Image';
    exportBtn.addEventListener('click', () => {
      if (this.onExport) {
        this.onExport(this.format, this.quality / 100, this.scale);
      }
    });

    panel.appendChild(exportBtn);
    this.container.appendChild(panel);
  }
}

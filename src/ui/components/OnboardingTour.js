export class OnboardingTour {
  constructor() {
    this.steps = [
      {
        title: 'Welcome to Garrytor! 🎭',
        body: 'Garrytor is a browser-based, non-destructive image editor built for speed and simplicity. Let’s show you around!',
        target: null
      },
      {
        title: 'Simple / Advanced Switch ⚙️',
        body: 'Toggle between **Simple Mode** (perfect for beginners, using smart sliders) and **Advanced Mode** (full curves, HSL, and details panels).',
        target: '.toggle-mode-container'
      },
      {
        title: 'Smart Slider Controls 🎨',
        body: 'Move sliders to adjust settings in real-time. Double-click any slider label or track to reset it back to zero!',
        target: '.panel-content'
      },
      {
        title: 'Real-time Histogram 📈',
        body: 'Monitor red, green, blue, and exposure levels instantly. Watch out for clipping indicators in the corners!',
        target: '.histogram-container'
      },
      {
        title: 'Built-in Presets ⚡',
        body: 'Apply instant cinema or film-look grading to your photos. You can even copy settings and paste them onto other photos!',
        target: '.presets-container'
      }
    ];
    this.currentStep = 0;
    this.overlay = null;
  }

  // Start tour if not completed
  start() {
    if (localStorage.getItem('garrytor_tour_completed')) return;
    this.showStep();
  }

  showStep() {
    this.destroy();

    const step = this.steps[this.currentStep];

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    
    const card = document.createElement('div');
    card.className = 'tour-card';

    // Highlight target if present
    if (step.target) {
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        targetEl.style.position = 'relative';
        targetEl.style.zIndex = '10000';
        targetEl.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 15px var(--accent-color)';
        
        // Save target reference to clean up later
        this.targetEl = targetEl;
      }
    }

    card.innerHTML = `
      <div class="tour-title">${step.title}</div>
      <div class="tour-body">${step.body}</div>
      <div class="tour-footer">
        <div class="tour-dots">
          ${this.steps.map((_, i) => `
            <div class="tour-dot ${i === this.currentStep ? 'active' : ''}"></div>
          `).join('')}
        </div>
        <div class="flex-row gap-sm">
          <button class="btn btn-ghost tour-skip-btn">Skip</button>
          <button class="btn btn-primary tour-next-btn">${this.currentStep === this.steps.length - 1 ? 'Done' : 'Next'}</button>
        </div>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // Listeners
    card.querySelector('.tour-next-btn').addEventListener('click', () => this.next());
    card.querySelector('.tour-skip-btn').addEventListener('click', () => this.skip());
  }

  next() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.showStep();
    } else {
      this.complete();
    }
  }

  skip() {
    this.complete();
  }

  complete() {
    localStorage.setItem('garrytor_tour_completed', 'true');
    this.destroy();
  }

  destroy() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // Clean up highlighted target
    if (this.targetEl) {
      this.targetEl.style.position = '';
      this.targetEl.style.zIndex = '';
      this.targetEl.style.boxShadow = '';
      this.targetEl = null;
    }
  }
}

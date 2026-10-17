import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  host: {
    class: 'block rounded-card border border-line bg-surface shadow-card',
  },
  templateUrl: './card.html',
})
export class Card {}

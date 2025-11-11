import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-offer-source-component',
  imports: [],
  templateUrl: './offer-source-component.html',
  styleUrl: './offer-source-component.scss'
})
export class OfferSourceComponent {
  @Output() close = new EventEmitter<void>();

  closeForm(): void {
    this.close.emit();
  }
}

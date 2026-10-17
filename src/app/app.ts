import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navigation } from '@shared/ui/navigation/navigation';

@Component({
  imports: [Navigation, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}

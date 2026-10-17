import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-navigation',
  host: { class: 'block' },
  templateUrl: './navigation.html',
})
export class Navigation {}

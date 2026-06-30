import {NgModule} from '@angular/core';
import {Router, RouterModule, Routes} from '@angular/router';

const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

  constructor(
    private router: Router,
  ) {
    // errorHandler on error route to home
    this.router.errorHandler = () => {
      this.router.navigate(['']);
    };
  }
}

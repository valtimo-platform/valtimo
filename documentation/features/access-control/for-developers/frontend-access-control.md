# Front-end access control

For each element of the user interface which is shown/hidden or enabled/disabled in the front-end based on an access control policy, a separate call is defined. These calls are subsequently bundled by the `PermissionService`, which is exported from `@valtimo/access-control`.

## Defining permissions

For a part of your user interface, for example a page, it is best to define all the permissions it needs to request in one file. In this file, define each permission to be requested separately, conforming to the interface `PermissionRequest`:

#### **`sample.permissions.ts`**

```typescript
import {PermissionRequest} from '@valtimo/access-control';

// Enums are defined for use in the below permissions. This is to avoid duplication, and is optional.
enum PERMISSION_ACTION {
    assign = 'ASSIGN',
    claim = 'CLAIM',
}

enum DOSSIER_DETAIL_PERMISSION_RESOURCE {
    domain = 'com.ritense.document.domain.impl.JsonSchemaDocument',
}

const CAN_CLAIM_CASE_PERMISSION: PermissionRequest = {
    action: PERMISSION_ACTION.claim,
    resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
};

const CAN_ASSIGN_CASE_PERMISSION: PermissionRequest = {
    action: PERMISSION_ACTION.assign,
    resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
};

export {CAN_CLAIM_CASE_PERMISSION, CAN_ASSIGN_CASE_PERMISSION}
```

## Using permissions

Permissions defined in the above example, are imported into your component code and transferred to the `PermissionService`, which returns an `Observable` emitting a `boolean` value for the respective permission:

#### **`sample.component.ts`**

```typescript
...
// import PermissionService
import {PermissionService} from '@valtimo/access-control';
...
// import previously defined permissions
import {
    CAN_CLAIM_CASE_PERMISSION,
    CAN_ASSIGN_CASE_PERMISSION,
} from '../permissions';
...

@Component({
    selector: 'sample-component',
    templateUrl: './sample-component.component.html',
    styleUrls: ['./sample-component.component.css'],
})
export class SampleComponent {

    // the permission to claim a case is defined directly as a component property
    public readonly canClaimCase$: Observable<boolean> = 
        this.permissionService.requestPermission(CAN_CLAIM_CASE_PERMISSION)
    
    // route paramaters are used to add dynamic context to the 'can assign case permission'
    public readonly canAssign$: Observable<boolean> = this.route.paramMap.pipe(
        switchMap((params: ParamMap) =>
            this.permissionService.requestPermission(
                // the defined permission itself
                CAN_ASSIGN_CASE_PERMISSION, 
                // context object as a second paramter
                {
                resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
                identifier: params.get('documentId') ?? '',
            })
        )
    );
    
    constructor(
        ...
        // inject PermissionService
        private readonly permissionService: PermissionService
    ) {
    }
}
```

With each permission defined as an `Observable` emitting a `boolean` value, with its own component property, they may now be used in the template code of your component. To do this efficiently, it is recommended to use `async` pipes:

#### **`sample.component.html`**

```angular2html
<div class="container">
    <!--    The claim button is shown when a case can be claimed-->
    <button *ngIf="canClaimCase$ | async" (click)="claim()">
        Claim case
    </button>

    <!--    The assign button is enabled when a case can be assigned-->
    <button [disabled]="(canAssign$ | async) === false" (click)="assign()">
        Assign case
    </button>
</div>
```

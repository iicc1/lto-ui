import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LtoPublicNodeService } from '@legalthings-one/platform';
import { Observable } from 'rxjs';
import { switchMap, shareReplay, map, withLatestFrom, filter, combineLatest } from 'rxjs/operators';
import { EncoderService } from '../../core';

@Component({
  selector: 'poe-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit {
  id$: Observable<string>;
  transaction$: Observable<any>;
  type$: Observable<4 | 8 | 9 | 12>; // Supported types

  anchors$: Observable<any[]>;
  checkedReceipt$: Observable<any>;

  constructor(
    private activatedRoute: ActivatedRoute,
    private publicNode: LtoPublicNodeService,
    private encoderService: EncoderService
  ) {
    this.id$ = activatedRoute.params.pipe(map(params => params['id']));
    this.transaction$ = this.id$.pipe(
      switchMap(id => publicNode.transaction(id)),
      shareReplay(1)
    );

    this.type$ = this.transaction$.pipe(map(transaction => transaction.type));

    this.anchors$ = this.transaction$.pipe(
      map(transaction => {
        if (transaction.type === 12) {
          return transaction.data.filter((item: any) => item.key === '⚓');
        }

        if (transaction.type === 15) {
          return transaction.anchors;
        }

        return [];
      }),
      map(anchors => {
        return anchors.map((anchorData: any) => {
          const anchorValue = this.encoderService.base64Decode(anchorData.value.slice(7)); // Slice "base64:" part
          const hash = this.encoderService.hexEncode(anchorValue);
          const base58 = this.encoderService.base58Encode(anchorValue);
          return {
            value: anchorData.value,
            hash,
            base58
          };
        });
      })
    );

    this.checkedReceipt$ = this.activatedRoute.queryParams.pipe(
      map(params => params['hash']),
      filter(hash => !!hash),
      combineLatest(this.anchors$),
      map(([hash, anchors]) => {
        const anchor = anchors.find(anchor => anchor.hash === hash);
        return {
          hash,
          invalid: !anchor
        };
      })
    );
  }

  ngOnInit() {}

  showRecipient(transaction: { type: number }): boolean {
    // Hide recipient for data/anchor transactions
    return transaction.type !== 12 && transaction.type !== 15;
  }
}

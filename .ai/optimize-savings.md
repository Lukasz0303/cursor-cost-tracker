## Lifetime savings

Run 21. Twenty requests on one model billed 32.38 $. Cache write is 0 and cache read is 53,798,528. The last slice is 10.77 $ across 3 requests at median cache read 5,537,280; the first slice is 2.18 $ across 4 requests at median cache read 343,296. The next similar turn stays at the first slice's per-request cost (2.18 / 4 = 0.545 $) instead of the last slice's (10.77 / 3 = 3.59 $). Mid save on that turn: 5,193,984 cache-read tokens (5,537,280 − 343,296) and 3.05 $ (3.59 − 0.545).

```cct-savings
project: cursor-cost-tracker
tokens_mid: 34642212
usd_mid: 20.49
run: 21
```

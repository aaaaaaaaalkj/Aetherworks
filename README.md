# Aetherworks

A minimal idle game about eight machines that turn time into credits.

## How it plays

- Each machine is a bar whose height is the log of what its next level costs.
- Your credits are a water line on the same log scale. A bar that is fully under water can be bought (click it or press `1`–`8`). Buying spends the credits, the water drops, and the bar grows to the next level's cost.
- **Share of production** shows how much of your income each machine provides.
- **Credits over time** plots credits against time since the start, both on log scales, so the past compresses. Coloured ticks below it mark every purchase.

## The economy

Every machine is defined in `src/game/machines.ts` by two functions of its level, `cost(L)` and `production(L)`.

- Each level costs on average 10^5.5 times more than the previous one. A machine's own output would take months to years to pay for its next level.
- The eight cost ladders are offset and interleaved, so across all machines there is always a next level within reach of the combined output. The largest gap between neighbouring costs is about 14×.
- Each ladder wobbles in its own pattern, and each machine has its own efficiency, so the dominant machine keeps changing.
- Payback time grows slowly with scale. Purchases come every minute or two at first, about every 20 minutes after a day, hours after a week, and days after a few months.

## Idle time

Progress continues while the game is not in front of you: when the app is closed, the tab is in the background, or the computer is asleep. That time is applied when you come back, **squared in hours**:

| Away | Counts as |
|---|---|
| 30 min | 15 min |
| 1 hour | 1 hour |
| 2 hours | 4 hours |
| 8 hours | 64 hours |

Short breaks earn less than real time and long absences earn much more. Any gap over 5 seconds counts as idle. Returning after at least a minute shows how much production the absence was worth.

## Testing

The toolbar speeds time up to 100,000× and can jump ahead by a minute up to a week. **Away** simulates being idle for 30 min up to 8 hours, through the same idle rule. **Reset** starts over. Progress is saved in the browser and keeps accruing while the tab is closed.

## Development

```sh
npm install
npm run dev     # http://localhost:3001
npm run lint    # type check
npm run build   # static site in dist/
```

## License

[MIT](LICENSE)

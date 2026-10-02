# Aetherworks

A minimal idle game about eight machines that turn time into credits.

**Play:** https://aaaaaaaaalkj.github.io/Aetherworks/

## How it plays

- Each machine is a bar whose height is the log of what its next level costs.
- Machines produce in pulses. A pulse climbs each built machine's bar, and when it reaches the top, everything the machine made during that pulse lands in your balance. At level 1 the leftmost machine pulses every 5 seconds, the rightmost every 10 minutes (5s, 10s, 20s, 40s, 75s, 2.5m, 5m, 10m), and every further level makes a machine's pulse 1.5× longer. The pulse only changes when credits arrive, not how many. Hover a bar to see its current period.
- The header shows how long until the next upgrade can be bought (nothing while one already can). For waits over an hour it also shows how long you would have to stay away instead, since idle time counts squared. The button on the right switches to full screen where the browser allows it.
- **Auto** (on by default, at the bottom right) buys the cheapest upgrade it can afford. It pauses when you come back after an absence, so you can spend what built up yourself.
- Your credits are a water line on the same log scale. A bar that is fully under water can be bought (click it or press `1`–`8`). Buying spends the credits, the water drops, and the bar grows to the next level's cost.
- **Credits over time** plots credits against time since the start, both on log scales, so the past compresses. The label at its left end is the game's age. Coloured ticks below it mark every purchase, and a dashed line marks every prestige, where the run's total drops back to the start. The area under the total is coloured by each machine's share of production at that moment, so the right edge shows today's mix; hover it to see the leading machines.

## The economy

Every machine is defined in `src/game/machines.ts` by two functions of its level, `cost(L)` and `production(L)`.

- Each level costs on average 10^5.5 times more than the previous one. A machine's own output would take months to years to pay for its next level.
- The eight cost ladders are offset and interleaved, so across all machines there is always a next level within reach of the combined output. The largest gap between neighbouring costs is about 14×.
- Each ladder wobbles in its own pattern, and each machine has its own efficiency, so the dominant machine keeps changing.
- Every new game deals the eight ladders to the eight slots in a random order, so the cheapest upgrade doesn't simply move left to right. The ladders themselves never change, so every game paces the same.
- Payback time grows slowly with scale. Purchases come every minute or two at first, about every 20 minutes after a day, hours after a week, and days after a few months.

## Prestige

Once any machine has reached level 3, the **Prestige** tab lets you end the run. The run's upgrades, squared, become prestige points.

Each run locks one metric at random: cost, payout or pulse duration. That run's points all go into one pool of the locked metric:

- one of the 8 machines, or
- one of the 3 highest levels reached so far.

Every pool starts at 1 and grows by the points put into it. For each metric, the boost of a machine at a level is its machine pool × its level pool, and its effect is `boost^(1/4)`: payout is multiplied by it, cost and pulse duration are divided by it. One prestige of 500 points gives ×4.7 to everything that pool touches; 500 each into a machine and a level gives ×22 where they meet.

The heatmap shows the locked metric's boosts on the three highest levels, and hovering or picking a pool previews what it would raise. Levels that fall out of the top three keep their boosts but can no longer be chosen. **?** explains the rules in the game.

Prestige resets every machine to level 0 and the credits to the starting 1. Game time, the history and the slot deal carry on, and the chart marks each prestige.

## Idle time

Progress continues while the game is not in front of you: when the app is closed, the tab is in the background, or the computer is asleep. That time is applied when you come back, **squared in hours**:

| Away | Counts as |
|---|---|
| 30 min | 15 min |
| 1 hour | 1 hour |
| 2 hours | 4 hours |
| 8 hours | 64 hours |

Short breaks earn less than real time and long absences earn much more. Any gap over 5 seconds counts as idle. Returning after at least a minute shows how much production the absence was worth, in the header, which is where the game says anything it needs to.

## Testing

The **Cheats** tab speeds time up to 100,000× and can jump ahead by a minute up to a week. **Away** simulates being idle for 30 min up to 8 hours, through the same idle rule. **Reset** starts over. Progress is saved in the browser and keeps accruing while the tab is closed.

## Development

```sh
npm install
npm run dev     # http://localhost:3001
npm run lint    # type check
npm run build   # static site in dist/
```

## License

[MIT](LICENSE)

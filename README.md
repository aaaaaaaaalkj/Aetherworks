# Aetherworks

An idle game about a foundry of impossible machines. Each machine turns time into credits, and credits improve the machines.

- Eight machines, each drawn as an animated contraption that grows new parts as it improves.
- Costs and output are never shown. A machine's card lights up when its next improvement is affordable.
- Credits flow from the machines into a nixie-tube vault. Progress is saved in the browser and keeps accruing while the tab is closed.

## Controls

- Click a lit machine, or press `1`–`8`, to improve it. Hold the button to keep upgrading.
- `W` opens the **Time Warp** testing panel: run time up to 100,000× faster, jump ahead by minutes to a week, or reset progress.

## Tuning

Each machine is defined in `src/game/machines.ts` by two functions of its level: `cost(L)` and `production(L)`.

## Development

```sh
npm install
npm run dev     # http://localhost:3001
npm run lint    # type check
npm run build   # static site in dist/
```

## License

[MIT](LICENSE)

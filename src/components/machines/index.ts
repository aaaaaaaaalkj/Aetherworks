import type { ComponentType } from 'react';
import type { MachineKind } from '../../game/machines';
import { Bloom } from './Bloom';
import { Coil } from './Coil';
import type { ArtProps } from './common';
import { Gears } from './Gears';
import { Hourglass } from './Hourglass';
import { Orrery } from './Orrery';
import { Prism } from './Prism';
import { Pump } from './Pump';
import { Singularity } from './Singularity';

export const MACHINE_ART: Record<MachineKind, ComponentType<ArtProps>> = {
  coil: Coil,
  gears: Gears,
  bloom: Bloom,
  pump: Pump,
  prism: Prism,
  hourglass: Hourglass,
  orrery: Orrery,
  singularity: Singularity,
};

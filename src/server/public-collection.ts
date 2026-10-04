import { resources } from '../lib/data';
import { publicRecords } from './catalogue';
// Educational examples remain explicitly labelled and separate from released records.
export async function publicCollection() { return [...await publicRecords(), ...resources.filter(r=>r.sample)]; }

# @orqenix-pro/self-learning-advanced

> Pro (BSL-1.1) advanced instinct detection for Orqenix.
> Phase 8 (D8.γ). Charter gate G67 (advanced portion).
> Converts to Apache-2.0 on 2030-06-11 (4 years).

## Mission

Extends the basic OSS detection (`@orqenix/self-learning-detection`) with
advanced algorithms. Implements `IDetector` for drop-in replacement.

| Algorithm | OSS basic | Pro advanced |
|---|---|---|
| Sequence detection | ✅ exact match | ✅ + fuzzy/template |
| Template extraction | — | ✅ parameterize variations |
| Semantic clustering | — | ✅ group similar (not identical) sequences |
| A/B success comparison | — | ✅ compare pattern variants |
| Time-savings estimation | basic | ✅ accurate per-action timing model |

## Drop-in replacement

```ts
import { AdvancedDetector } from '@orqenix-pro/self-learning-advanced';
// Same IDetector contract as BasicDetector; richer patterns
const detector = new AdvancedDetector({ db });
```

## License

BSL-1.1 → Apache-2.0 (4-year conversion). See ./LICENSE.

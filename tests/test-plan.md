# Test Plan

| ID | Area | Operation | Expected Result |
| --- | --- | --- | --- |
| TC-1 | Page load | Open `/` | Canvas animation and HUD are visible |
| TC-2 | Boids movement | Wait 10 seconds | Birds continue moving without all collapsing into one point |
| TC-3 | Mouse follow | Move pointer across canvas in Follow mode | Target marker moves and flock gradually follows |
| TC-4 | Gather | Press `G` or click Gather | Birds converge toward target point |
| TC-5 | Scatter | Press `S` or click Scatter | Birds fly away from target point |
| TC-6 | Idle | Press `I` or click Idle | Target force is disabled and flock resumes natural movement |
| TC-7 | Bird count | Change Birds slider | HUD count and flock size update |
| TC-8 | Parameter tuning | Change Speed and Radius sliders | Movement changes without page errors |
| TC-9 | Camera permission | Click Camera Off | Browser asks for camera permission on HTTPS or localhost |
| TC-10 | Gesture fallback | Deny camera permission | App continues working with mouse and keyboard |
| TC-11 | Unit tests | Run `npm test` | Boids algorithm tests pass |
| TC-12 | Cloud Run | Open deployed URL | App loads over HTTPS |

## Automated Tests

The repository includes Node.js unit tests for:

- flock initialization bounds
- separation
- alignment
- cohesion
- flock resizing
- scatter interaction force

Run:

```bash
npm test
```

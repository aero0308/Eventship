#!/bin/bash
cd /home/z/my-project/public/images/profile-bgs
declare -A PROMPTS
PROMPTS[aurora]="Abstract flowing aurora gradient waves, deep emerald green and teal silk ribbons of light, dark elegant backdrop, smooth soft blur, premium wallpaper, no text, no people, high quality, detailed"
PROMPTS[ember]="Abstract warm amber and sunset orange gradient waves with soft golden light glow, smooth silk texture, dark elegant backdrop, premium wallpaper, no text, no people, high quality, detailed"
PROMPTS[dunes]="Abstract soft terracotta and warm sand dunes landscape at dusk, minimal smooth curves, dreamy warm gradient sky, elegant minimal wallpaper, no text, no people, high quality, detailed"
PROMPTS[tide]="Abstract dark teal ocean waves at night, moody deep green water surface with subtle bioluminescent glow, smooth long exposure, premium elegant wallpaper, no text, no people, high quality, detailed"
PROMPTS[meadow]="Abstract fresh botanical pattern, lush green tropical leaves with soft light and shadow, dark moody background, premium elegant wallpaper, no text, no people, high quality, detailed"
PROMPTS[slate]="Abstract dark graphite stone texture with subtle emerald green light streaks and soft geometric shapes, minimal premium dark wallpaper, no text, no people, high quality, detailed"
for name in aurora ember dunes tide meadow slate; do
  if [ -s "./$name.png" ]; then echo "SKIP $name (exists)"; continue; fi
  for attempt in 1 2 3 4 5 6; do
    echo "--- $name attempt $attempt $(date +%T)"
    z-ai image -p "${PROMPTS[$name]}" -o "./$name.png" -s 1344x768 && { echo "OK $name"; break; }
    sleep 45
  done
done
echo "ALL_DONE"

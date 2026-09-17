#!/bin/bash
cd /home/z/my-project/public/images/profile-bgs
z-ai image -p "Abstract flowing aurora gradient waves, deep emerald green and teal silk ribbons of light, dark elegant backdrop, smooth soft blur, premium wallpaper, no text, no people, high quality, detailed" -o "./aurora.png" -s 1440x720
z-ai image -p "Abstract warm amber and sunset orange gradient waves with soft golden light glow, smooth silk texture, dark elegant backdrop, premium wallpaper, no text, no people, high quality, detailed" -o "./ember.png" -s 1440x720
z-ai image -p "Abstract soft terracotta and warm sand dunes landscape at dusk, minimal smooth curves, dreamy warm gradient sky, elegant minimal wallpaper, no text, no people, high quality, detailed" -o "./dunes.png" -s 1440x720
z-ai image -p "Abstract dark teal ocean waves at night, moody deep green water surface with subtle bioluminescent glow, smooth long exposure, premium elegant wallpaper, no text, no people, high quality, detailed" -o "./tide.png" -s 1440x720
z-ai image -p "Abstract fresh botanical pattern, lush green tropical leaves with soft light and shadow, dark moody background, premium elegant wallpaper, no text, no people, high quality, detailed" -o "./meadow.png" -s 1440x720
z-ai image -p "Abstract dark graphite stone texture with subtle emerald green light streaks and soft geometric shapes, minimal premium dark wallpaper, no text, no people, high quality, detailed" -o "./slate.png" -s 1440x720
echo "ALL_DONE"

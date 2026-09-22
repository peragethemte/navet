---
title: Set the weather location
description: Choose the coordinates Navet fetches its weather forecast for.
editUrl: https://github.com/awesomestvi/navet/edit/main/docs/how-to/settings/local-services.md
---

Local services holds the places your household cares about. Today that is the weather location the
Yr.no forecast is fetched for.

The weather location is part of the shared dashboard profile, so a wall panel, a phone, and a
laptop signed in to the same Navet installation all show the same place.

## Set the location

1. Open **Settings → Local services**.
2. Enter **Latitude** and **Longitude** in decimal degrees, for example `59.2839` and `11.1094`.
   Both a period and a comma work as the decimal separator.
3. Enter a **Place name**. This is the label shown on the weather card.

The weather card updates a few seconds after the coordinates change. Navet keeps four decimals,
which is accurate to about ten metres.

Latitude must be between -90 and 90, and longitude between -180 and 180. Navet shows an inline
message and keeps the previous location until the coordinates make sense again.

## Use the current device's location

Select **Use this device** to fill in the coordinates from the browser's own location service. The
browser asks for permission first, and a wall panel without a location sensor can return a rough
or unavailable position. Enter the coordinates by hand when that happens.

## Fall back to the server location

Select **Use server location** to clear the fields. Navet then uses the `NAVET_YR_LATITUDE`,
`NAVET_YR_LONGITUDE`, and `NAVET_YR_LOCATION_NAME` values configured where Navet runs. When neither
is set, the weather card has no forecast to show.

## Find coordinates for a place

Open the place on any map service and read the decimal coordinates from it. Yr.no shows them in the
address of a forecast page.

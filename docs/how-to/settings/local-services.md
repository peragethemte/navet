---
title: Set up local services
description: Choose the weather location and the public-transport journeys Navet shows.
editUrl: https://github.com/awesomestvi/navet/edit/main/docs/how-to/settings/local-services.md
---

Local services holds the places your household cares about: the location the weather forecast is
fetched for, and the public-transport journeys the departures card plans.

Both are part of the shared dashboard profile, so a wall panel, a phone, and a laptop signed in to
the same Navet installation all show the same places.

## Set the weather location

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

## Add a transit journey

A journey describes a trip your household takes regularly, such as the morning run to school. Navet
plans it backwards from the time you need to arrive, so the card answers whether you get there on
time rather than only listing what leaves next.

1. Open **Settings → Local services** and select **Add journey**.
2. Enter a **Name**, for example `School run`. It labels the journey on the card.
3. Type into **From** and **To** to search for stops, then select one from the results.
4. Set **Arrive by** to the time you need to be at the destination.
5. Set **Show from** to how long before that time the journey should appear on the card.
6. Select the **Days** the journey runs. A journey with no days selected is never shown, and days
   matter more than they look: without them a Friday evening dashboard would offer Saturday's
   school bus.

The journey is saved as soon as both stops and at least one day are set. Remove a journey with the
bin button next to its name. You can save up to eight journeys.

### How stop search works

Stop search covers every stop in Norway. When a weather location is set, results are limited to
roughly 50 km around it, which is what makes searching for a common name such as `skole` useful.
Without a weather location the search runs nationwide, so include the place name in what you type.

### Add the departures card

Journeys only appear once the card is on a dashboard. Enter edit mode, select **Add card**, and
choose **Departures**. The card shows every journey currently inside its **Show from** window,
earliest deadline first, with two or three alternatives each depending on the card size. When no
journey is active, it rolls forward to the next one so an evening dashboard shows tomorrow morning.

Live delays, platform numbers, walking distance, and cancellations come from the transport
operator. Departures further ahead than the operator publishes live data for show timetable times.

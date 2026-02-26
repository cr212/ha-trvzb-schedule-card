# Home Assistant TRVZB scheduler card

This is a simple Home Assistant card for controlling the schedules on
[Sonoff
TRVZB](https://sonoff.tech/en-uk/products/sonoff-zigbee-thermostatic-radiator-valve?srsltid=AfmBOopnZM5u-ihrCrQOJIg2un7ycNRJlpiBTcAuJMFE1zr5sb0XpNls)
devices.  These are exposed through
[Zigbee2MQTT](https://www.zigbee2mqtt.io/devices/TRVZB.html#weekly-schedule-sunday-text) as entities such as
`text.office_trv_weekly_schedule_sunday` which is a list of time and
temperature transition points.

This card provides an editor for these schedules. It shows:

- Buttons to select which day is shown in text form
- A text box with the currently selected day which can be edited (or use
  copy and paste)
- A diagram showing all the days. Each day has a bar representing the day
  with different temperatures at different times.  Transition points can be
  dragged, deleted, or the temperature edited by clicking on it.
- An add button to add a new transition to the currently selected day.


On any change, the entities are updated (throttled to not overload HA, so it
can take a short time before the changes are saved).

The card does not handle updates to the entities by other components while
it is visible.

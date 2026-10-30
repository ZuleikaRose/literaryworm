# Plan limits: a check on real devices

What automated tests can't cover: two or three real devices, one account, the live site.
Use a member account on **Basic** (1 offline device, 5 hours of listening a month). About 20 minutes.

Already covered elsewhere: the database rules were checked live on a Basic account (a first
device gets a place, a second is refused with the device listed, freeing the first lets the
second in), and the rules in the browser have unit tests (`src/lib/planLimits.test.ts`) and
smoke tests (`e2e/smoke.e2e.ts`).

## You need

- Device A (a laptop) and device B (a phone), both signed in to the same Basic account.
- A public-domain book with a recording, such as *Frankenstein*.

## 1. Offline places

1. On A, open *Frankenstein* and choose **Save the text**. It saves.
   Account → Plan and billing → *This month* shows **1 of 1 in use**, with A marked *(this device)*.
2. On B, open the same book and choose **Save the text**.
   Expected: no download; a panel says the Basic plan keeps offline books on 1 device and lists A with *Free*.
3. On B, choose **Free** next to A. Expected: the text saves on B, and *This month* on B shows B.
4. On A, sign out and back in (or close the tab and open the site again).
   Expected: A's offline copy is gone. The book page offers **Save the text** again, and with A
   offline the book no longer opens without a connection.
5. On A, choose **Save the text** again. Expected: refused, listing B.

## 2. Listening across devices

1. Note *Audiobooks* in *This month* on A (say 1 h 10 min).
2. On B, play an audiobook for 5 minutes, with the screen locked for part of it (background listening counts).
3. On A, open the player and press Play. Within a few seconds the line under the progress bar
   (*… of this month's 5 hours left for the household*) drops by about 5 minutes.
4. Optional, for the limit itself: on a test account that has used about 4 h 55 min, play until
   the player shows *That's this month's listening* on both devices (B checks in within 5 minutes
   while playing), and the bell shows *Most of this month's listening is used* once 4 hours have passed.

## 3. Report

Note anything that doesn't match, with the device, browser and time. The places are in
`offline_devices`; the listening is `reading_days.listening_minutes`, summed for the month.

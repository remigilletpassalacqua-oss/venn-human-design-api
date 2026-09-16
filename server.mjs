import express from "express";
import { calculateHumanDesign } from "natalengine";
import tzlookup from "@photostructure/tz-lookup";
import { DateTime } from "luxon";

const app = express();

app.use(
  '/venn-assets',
  express.static('public/venn-assets', {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Cache-Control',
        'public, max-age=31536000, immutable',
      );
    },
  }),
);

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use('/hexagrams', express.static('public/hexagrams'));

function parseBirthDate(value) {
  if (!value) {
    throw new Error("birthDate is required");
  }

  // YYYY-MM-DD
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  // DD/MM/YYYY
  match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (match) {
    return {
      year: Number(match[3]),
      month: Number(match[2]),
      day: Number(match[1]),
    };
  }

  throw new Error(
    "Invalid birthDate format. Expected YYYY-MM-DD or DD/MM/YYYY"
  );
}

function parseBirthTime(value) {
  if (!value) {
    throw new Error("birthTime is required");
  }

  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    throw new Error("Invalid birthTime format. Expected HH:mm");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Invalid birthTime");
  }

  return { hour, minute };
}

app.post("/human-design", (req, res) => {
  try {
    const {
      birthDate,
      birthTime,
      latitude,
      longitude,

      // Ancien format conservé pour nos tests
      birthHour,
      timezone,
    } = req.body;

    let normalizedBirthDate;
    let normalizedBirthHour;
    let normalizedTimezone;
    let ianaTimezone = null;

    // Nouveau format Venn
    if (
      birthTime !== undefined &&
      latitude !== undefined &&
      longitude !== undefined
    ) {
      const date = parseBirthDate(String(birthDate));
      const time = parseBirthTime(String(birthTime));

      const lat = Number(latitude);
      const lng = Number(longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Invalid latitude or longitude");
      }

      ianaTimezone = tzlookup(lat, lng);

      const localBirthDateTime = DateTime.fromObject(
        {
          year: date.year,
          month: date.month,
          day: date.day,
          hour: time.hour,
          minute: time.minute,
        },
        {
          zone: ianaTimezone,
        }
      );

      if (!localBirthDateTime.isValid) {
        throw new Error(
          `Invalid birth date/time: ${localBirthDateTime.invalidExplanation}`
        );
      }

      normalizedBirthDate =
        `${date.year}-` +
        `${String(date.month).padStart(2, "0")}-` +
        `${String(date.day).padStart(2, "0")}`;

      normalizedBirthHour =
        time.hour + time.minute / 60;

      normalizedTimezone =
        localBirthDateTime.offset / 60;
    }

    // Ancien format : permet de continuer nos tests précédents
    else if (
      birthHour !== undefined &&
      timezone !== undefined
    ) {
      normalizedBirthDate = birthDate;
      normalizedBirthHour = Number(birthHour);
      normalizedTimezone = Number(timezone);
    }

    else {
      throw new Error(
        "Provide birthDate + birthTime + latitude + longitude"
      );
    }

    const chart = calculateHumanDesign(
      normalizedBirthDate,
      normalizedBirthHour,
      normalizedTimezone
    );

    res.json({
      ...chart,

      vennInput: {
        birthDate: normalizedBirthDate,
        birthHour: normalizedBirthHour,
        timezone: normalizedTimezone,
        ianaTimezone,
      },
    });
  } catch (error) {
    res.status(400).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Venn NatalEngine API running on port ${PORT}`);
});

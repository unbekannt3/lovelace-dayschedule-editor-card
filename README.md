# Day Schedule Editor Card

A custom card for Home Assistant that provides a visual editor for weekly schedules using input_text entities.

![Screenshot of Day Schedule Editor Card](screenshots/preview.png)

## Features

- Visual timeline-based schedule editor for each day of the week
- Click-and-drag interface for creating time slots
- Automatic merging of overlapping time slots
- Support for multiple languages (currently English and German)
- Easy integration with Home Assistant automations through input_text entities
- Responsive design that works on both desktop and mobile

## Prerequisites

- Node.js >= 18
- pnpm >= 8 (run `npm install -g pnpm` if you don't have it installed)

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click on "Frontend" section
3. Click the "+ Explore & Download Repositories" button
4. Search for "Day Schedule Editor Card"
5. Click Install

### Manual Installation

1. Download the `dayschedule-editor-card.js` file from the latest release
2. Upload the file to your `www/community/dayschedule-editor-card/` folder
3. Add the following to your `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /local/community/dayschedule-editor-card/dayschedule-editor-card.js
      type: module
```

## Configuration

### Step 1: Create Input Text Helpers

You have two options to create the required input_text helpers:

#### Option A: Using the Home Assistant UI

1. Go to Settings → Devices & Services
2. Click on "Helpers"
3. Click the "+ CREATE HELPER" button
4. Select "Text"
5. Create seven helpers with names like "Schedule Monday", "Schedule Tuesday", etc.
6. Note down the entity IDs (they should look like `input_text.schedule_monday`)

#### Option B: Using configuration.yaml

Add the following to your `configuration.yaml`:

```yaml
input_text:
  schedule_monday:
    name: Monday Schedule
  schedule_tuesday:
    name: Tuesday Schedule
  # ... repeat for all days
```

### Step 2: Add the Card

Add the card to your dashboard with the following configuration:

```yaml
type: custom:dayschedule-editor-card
entities:
  monday: input_text.schedule_monday
  tuesday: input_text.schedule_tuesday
  wednesday: input_text.schedule_wednesday
  thursday: input_text.schedule_thursday
  friday: input_text.schedule_friday
  saturday: input_text.schedule_saturday
  sunday: input_text.schedule_sunday
```

## Usage

- Click the '+' button to add a new time slot for a day
- Click an existing time slot to edit or delete it
- Overlapping time slots will be automatically merged
- Time slots are stored in the format "HH:MM-HH:MM" in the input_text entities

## Development

```bash
# Install dependencies
pnpm install

# Start a local Home Assistant instance with example configuration
pnpm run start:hass

# In another terminal, start the development server
pnpm run watch
```

### Development Home Assistant Instance

The `start:hass` command provides:

- A fresh Home Assistant instance on http://localhost:8123
- Pre-configured input_text helpers for testing
- Example dashboard with the schedule card
- Default login credentials:
  - Username: admin
  - Password: admin

You can also use these variations:

- `pnpm run start:hass-beta` - Run with beta version
- `pnpm run start:hass-dev` - Run with dev version

### Development Links

- Home Assistant: http://localhost:8123
- Card Development URL: http://localhost:4000/dayschedule-editor-card.js

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

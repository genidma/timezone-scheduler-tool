// Timezone Scheduler Tool

const speakers = [
    { city: 'New York (EST)', region: 'NA', timezone: -5 },
    { city: 'Host Time (Mountain)', region: 'NA', timezone: -7 },
    { city: 'London (GMT)', region: 'EU', timezone: 0 },
    { city: 'Berlin (CET)', region: 'EU', timezone: 1 },
    { city: 'Sydney (AEST)', region: 'AS', timezone: 10 },
    { city: 'Tokyo (JST)', region: 'AS', timezone: 9 },
];

const referenceDate = new Date(Date.UTC(2026, 2, 24, 0, 0, 0));
const EVENT_TIME_ZONE = 'America/Denver';
const EVENT_TIME_LABEL = 'Host Local';
const regionConfigs = {
    NA: {
        label: 'North America',
        offset: -5,
        size: 120,
        peakHour: 20,
        spread: 3,
    },
    EU: {
        label: 'Europe / Africa',
        offset: 0,
        size: 80,
        peakHour: 19,
        spread: 2.5,
    },
    AS: {
        label: 'Asia Pacific',
        offset: 8,
        size: 100,
        peakHour: 21,
        spread: 3.5,
    },
};

const regions = Object.keys(regionConfigs);
const audienceControlFields = [
    { key: 'size', label: 'Audience Size', min: 10, max: 250, step: 5, formatter: value => Math.round(value) },
    { key: 'peakHour', label: 'Peak Local Hour', min: 0, max: 23, step: 1, formatter: value => `${Math.round(value)}:00` },
    { key: 'spread', label: 'Viewing Window', min: 1, max: 6, step: 0.5, formatter: value => `${Number(value).toFixed(1)} hrs` },
];

let selectedSpeakers = [];
let uploadedAudienceProfiles = [];
let recommendedEventHour = 12;

const eventTimeInput = document.getElementById('event-time');
const speakersDiv = document.getElementById('speakers');
const audienceControlsDiv = document.getElementById('audience-controls');
const metricsDiv = document.getElementById('metrics');
const heatmapSvg = d3.select('#heatmap-svg');
const toggleButton = document.getElementById('toggle-legends');
const closeButton = document.getElementById('close-legends');
const sidebar = document.getElementById('legends-sidebar');
const audienceFileInput = document.getElementById('audience-file');
const uploadStatusDiv = document.getElementById('upload-status');
const uploadSummaryDiv = document.getElementById('upload-summary');
const recommendedTimeDiv = document.getElementById('recommended-time');
const recommendationReasonDiv = document.getElementById('recommendation-reason');
const applyRecommendedButton = document.getElementById('apply-recommended-time');
const resetUploadButton = document.getElementById('reset-upload');

renderSpeakers();
renderAudienceControls();
updateAudienceControlState();

eventTimeInput.addEventListener('change', refreshDashboard);
toggleButton.addEventListener('click', () => sidebar.classList.toggle('visible'));
closeButton.addEventListener('click', () => sidebar.classList.remove('visible'));
applyRecommendedButton.addEventListener('click', () => {
    eventTimeInput.value = formatLocalHourForInput(recommendedEventHour);
    refreshDashboard();
});
resetUploadButton.addEventListener('click', resetUploadedAudience);
audienceFileInput.addEventListener('change', handleAudienceUpload);

function renderSpeakers() {
    speakers.forEach(speaker => {
        const button = document.createElement('button');
        button.className = 'speaker';
        button.type = 'button';
        button.textContent = speaker.city;
        button.addEventListener('click', () => toggleSpeaker(speaker, button));
        speakersDiv.appendChild(button);
    });
}

function renderAudienceControls() {
    regions.forEach(region => {
        const config = regionConfigs[region];
        const card = document.createElement('section');
        card.className = 'audience-card';
        card.dataset.region = region;

        const title = document.createElement('h3');
        title.textContent = config.label;
        card.appendChild(title);

        audienceControlFields.forEach(field => {
            const wrapper = document.createElement('label');
            wrapper.className = 'audience-field';
            wrapper.setAttribute('for', `${region}-${field.key}`);

            const label = document.createElement('span');
            label.className = 'audience-label';
            label.textContent = field.label;

            const value = document.createElement('span');
            value.className = 'audience-value';
            value.id = `${region}-${field.key}-value`;
            value.textContent = field.formatter(config[field.key]);

            const input = document.createElement('input');
            input.className = 'audience-input';
            input.id = `${region}-${field.key}`;
            input.dataset.region = region;
            input.dataset.field = field.key;
            input.type = 'range';
            input.min = field.min;
            input.max = field.max;
            input.step = field.step;
            input.value = config[field.key];
            input.addEventListener('input', event => {
                const newValue = Number(event.target.value);
                regionConfigs[region][field.key] = newValue;
                value.textContent = field.formatter(newValue);
                refreshDashboard();
            });

            wrapper.append(label, value, input);
            card.appendChild(wrapper);
        });

        audienceControlsDiv.appendChild(card);
    });
}

function updateAudienceControlState() {
    regions.forEach(region => {
        updateAudienceControlValue(region, 'size', regionConfigs[region].size);
    });

    const sizeInputs = audienceControlsDiv.querySelectorAll('[data-field="size"]');
    sizeInputs.forEach(input => {
        input.disabled = uploadedAudienceProfiles.length > 0;
    });
}

function updateAudienceControlValue(region, field, value) {
    const fieldConfig = audienceControlFields.find(item => item.key === field);
    const input = document.getElementById(`${region}-${field}`);
    const label = document.getElementById(`${region}-${field}-value`);
    if (input) {
        input.value = value;
    }
    if (label && fieldConfig) {
        label.textContent = fieldConfig.formatter(value);
    }
}

function toggleSpeaker(speaker, button) {
    const index = selectedSpeakers.indexOf(speaker);
    if (index > -1) {
        selectedSpeakers.splice(index, 1);
        button.classList.remove('selected');
    } else {
        selectedSpeakers.push(speaker);
        button.classList.add('selected');
    }
    refreshDashboard();
}

function handleAudienceUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = loadEvent => {
        try {
            const text = String(loadEvent.target.result || '');
            const parsed = parseAudienceCsv(text);
            applyUploadedAudience(parsed);
        } catch (error) {
            uploadedAudienceProfiles = [];
            uploadStatusDiv.textContent = error.message;
            uploadStatusDiv.className = 'upload-status error';
            uploadSummaryDiv.innerHTML = '';
            syncRegionSizesWithUpload();
            updateAudienceControlState();
            refreshDashboard();
        }
    };
    reader.readAsText(file);
}

function parseAudienceCsv(text) {
    const rows = text
        .split(/\r?\n/)
        .map(row => row.trim())
        .filter(Boolean)
        .map(parseCsvLine);

    if (rows.length < 2) {
        throw new Error('Upload needs a header row and at least one audience row.');
    }

    const headers = rows[0].map(normalizeHeader);
    const timezoneIndex = headers.findIndex(header => ['timezone', 'time_zone', 'tz'].includes(header));
    if (timezoneIndex === -1) {
        throw new Error('CSV must include a timezone column.');
    }

    const countIndex = headers.findIndex(header => ['count', 'audience_count', 'attendees', 'responses', 'quantity'].includes(header));
    const grouped = new Map();
    const invalidTimezones = [];
    let totalAudience = 0;
    let validRows = 0;

    rows.slice(1).forEach(columns => {
        const timezone = (columns[timezoneIndex] || '').trim();
        if (!timezone) {
            return;
        }

        if (!isValidTimeZone(timezone)) {
            invalidTimezones.push(timezone);
            return;
        }

        const countValue = countIndex === -1 ? 1 : Number(columns[countIndex]);
        const count = Number.isFinite(countValue) && countValue > 0 ? countValue : 1;
        const existing = grouped.get(timezone) || 0;
        grouped.set(timezone, existing + count);
        totalAudience += count;
        validRows += 1;
    });

    if (grouped.size === 0) {
        throw new Error('No valid timezone values were found in the upload. Use IANA values like America/New_York or Europe/London.');
    }

    const profiles = Array.from(grouped.entries()).map(([timeZone, count]) => ({
        timeZone,
        count,
        region: mapTimeZoneToRegion(timeZone),
    }));

    return {
        profiles,
        totalAudience,
        validRows,
        invalidTimezones,
    };
}

function applyUploadedAudience(parsed) {
    uploadedAudienceProfiles = parsed.profiles;
    syncRegionSizesWithUpload();
    updateUploadSummary(parsed);
    updateAudienceControlState();
    const recommendation = findRecommendedEventTime();
    recommendedEventHour = recommendation.hour;
    eventTimeInput.value = formatLocalHourForInput(recommendedEventHour);
    refreshDashboard();
}

function resetUploadedAudience() {
    uploadedAudienceProfiles = [];
    audienceFileInput.value = '';
    uploadStatusDiv.textContent = 'No audience file uploaded. Manual audience controls are active.';
    uploadStatusDiv.className = 'upload-status';
    uploadSummaryDiv.innerHTML = '';
    restoreDefaultRegionSizes();
    updateAudienceControlState();
    refreshDashboard();
}

function syncRegionSizesWithUpload() {
    if (uploadedAudienceProfiles.length === 0) {
        restoreDefaultRegionSizes();
        return;
    }

    const regionCounts = { NA: 0, EU: 0, AS: 0 };
    uploadedAudienceProfiles.forEach(profile => {
        regionCounts[profile.region] += profile.count;
    });

    regions.forEach(region => {
        regionConfigs[region].size = Math.max(regionCounts[region], 0);
    });
}

function restoreDefaultRegionSizes() {
    regionConfigs.NA.size = 120;
    regionConfigs.EU.size = 80;
    regionConfigs.AS.size = 100;
}

function updateUploadSummary(parsed) {
    const topTimezones = [...parsed.profiles]
        .sort((left, right) => right.count - left.count)
        .slice(0, 5)
        .map(profile => `<span class="summary-pill">${profile.timeZone} (${Math.round(profile.count)})</span>`)
        .join('');

    uploadStatusDiv.textContent = `Audience upload applied: ${parsed.validRows} rows, ${Math.round(parsed.totalAudience)} total audience, across ${parsed.profiles.length} timezones.`;
    uploadStatusDiv.className = 'upload-status success';

    const invalidSummary = parsed.invalidTimezones.length > 0
        ? `<div class="summary-note">Ignored invalid timezones: ${parsed.invalidTimezones.slice(0, 5).join(', ')}</div>`
        : '';

    uploadSummaryDiv.innerHTML = `
        <div class="summary-block">
            <div class="summary-label">Top Timezones</div>
            <div class="summary-pills">${topTimezones}</div>
        </div>
        ${invalidSummary}
    `;
}

function refreshDashboard() {
    const recommendation = findRecommendedEventTime();
    recommendedEventHour = recommendation.hour;
    updateRecommendationCard(recommendation);
    updateFeedback();
    updateHeatmap();
}

function updateRecommendationCard(recommendation) {
    recommendedTimeDiv.textContent = `${formatLocalHourForInput(recommendation.hour)} ${EVENT_TIME_LABEL}`;
    recommendationReasonDiv.textContent = recommendation.reason;
}

function updateFeedback() {
    const eventHour = getEventHour();

    let totalAvailability = 0;
    let totalAudience = 0;
    let totalQuality = 0;

    selectedSpeakers.forEach(speaker => {
        const localHour = normalizeHour(eventHour + speaker.timezone);
        const available = localHour >= 9 && localHour <= 17;
        if (available) {
            totalAvailability += 1;
        }
    });

    regions.forEach(region => {
        const audience = calculateAudience(region, eventHour);
        totalAudience += audience.size;
        totalQuality += audience.quality;
    });

    const avgQuality = totalQuality / regions.length;
    const leadingAudience = getLeadingAudienceLabel();

    metricsDiv.innerHTML = `
        <div class="metric">Speakers Available: ${totalAvailability}/${selectedSpeakers.length}</div>
        <div class="metric">Total Audience Size: ${Math.round(totalAudience)}</div>
        <div class="metric">Average Audience Quality: ${avgQuality.toFixed(2)} (higher is better)</div>
        <div class="metric">Compromise Score: ${calculateCompromise(totalAvailability, totalAudience, avgQuality)}</div>
        <div class="metric">Audience Majority: ${leadingAudience}</div>
    `;
}

function getLeadingAudienceLabel() {
    if (uploadedAudienceProfiles.length === 0) {
        const dominantRegion = [...regions].sort((left, right) => regionConfigs[right].size - regionConfigs[left].size)[0];
        return `${regionConfigs[dominantRegion].label}`;
    }

    const leader = [...uploadedAudienceProfiles].sort((left, right) => right.count - left.count)[0];
    return `${leader.timeZone} (${Math.round(leader.count)})`;
}

function getEventHour() {
    const [hours, minutes] = eventTimeInput.value.split(':').map(Number);
    return convertEventLocalHourToUtc(hours + (minutes / 60));
}

function calculateAudience(region, eventHour) {
    const config = regionConfigs[region];

    if (uploadedAudienceProfiles.length > 0) {
        const regionProfiles = uploadedAudienceProfiles.filter(profile => profile.region === region);
        if (regionProfiles.length === 0) {
            return { size: 0, quality: 0.2, localHour: null };
        }

        let weightedAudience = 0;
        let totalCount = 0;
        let weightedQuality = 0;

        regionProfiles.forEach(profile => {
            const localHour = getLocalHourForTimeZone(profile.timeZone, eventHour);
            const quality = calculateQuality(localHour, config.peakHour, config.spread);
            weightedAudience += profile.count * (0.45 + 0.55 * quality);
            weightedQuality += profile.count * quality;
            totalCount += profile.count;
        });

        return {
            size: weightedAudience,
            quality: totalCount === 0 ? 0.2 : weightedQuality / totalCount,
            localHour: null,
        };
    }

    const localHour = normalizeHour(eventHour + config.offset);
    const quality = calculateQuality(localHour, config.peakHour, config.spread);
    const size = config.size * (0.45 + 0.55 * quality);
    return { size, quality, localHour };
}

function calculateQuality(localHour, peakHour, spread) {
    const distanceFromPeak = circularDistance(localHour, peakHour);
    return clamp(0.2 + 0.8 * Math.exp(-(distanceFromPeak ** 2) / (2 * (spread ** 2))), 0.2, 1);
}

function calculateCompromise(availability, audience, quality) {
    const availabilityWeight = selectedSpeakers.length === 0 ? 0 : availability / selectedSpeakers.length;
    const maxAudience = uploadedAudienceProfiles.length > 0
        ? uploadedAudienceProfiles.reduce((sum, profile) => sum + profile.count, 0)
        : regions.reduce((sum, region) => sum + regionConfigs[region].size, 0);
    const audienceWeight = maxAudience === 0 ? 0 : audience / maxAudience;
    const score = availabilityWeight * 0.5 + audienceWeight * 0.3 + quality * 0.2;
    return score.toFixed(2);
}

function findRecommendedEventTime() {
    const localTimes = d3.range(0, 24, 1);
    let best = { hour: getHourInEventTimeZone(getEventHour()), score: -1 };

    localTimes.forEach(localHour => {
        const utcHour = convertEventLocalHourToUtc(localHour);
        let totalAvailability = 0;
        let totalAudience = 0;
        let totalQuality = 0;

        selectedSpeakers.forEach(speaker => {
            const speakerLocalHour = normalizeHour(utcHour + speaker.timezone);
            if (speakerLocalHour >= 9 && speakerLocalHour <= 17) {
                totalAvailability += 1;
            }
        });

        regions.forEach(region => {
            const audience = calculateAudience(region, utcHour);
            totalAudience += audience.size;
            totalQuality += audience.quality;
        });

        const avgQuality = totalQuality / regions.length;
        const score = Number(calculateCompromise(totalAvailability, totalAudience, avgQuality));
        if (score > best.score) {
            best = { hour: localHour, score, avgQuality, totalAudience, availability: totalAvailability };
        }
    });

    const source = uploadedAudienceProfiles.length > 0 ? 'uploaded audience timezones' : 'current manual audience settings';
    const lead = getLeadingAudienceLabel();
    return {
        hour: best.hour,
        score: best.score,
        reason: `Best compromise from ${source}, with the heaviest pull coming from ${lead}.`,
    };
}

function updateHeatmap() {
    const times = d3.range(0, 24, 1);
    const data = [];

    times.forEach(localHour => {
        const utcHour = convertEventLocalHourToUtc(localHour);
        regions.forEach(region => {
            const audience = calculateAudience(region, utcHour);
            data.push({ time: localHour, region, engagement: audience.quality, audienceSize: audience.size });
        });
    });

    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 120 };

    heatmapSvg.attr('width', width).attr('height', height);

    const x = d3.scaleBand().domain(times).range([margin.left, width - margin.right]).padding(0.08);
    const y = d3.scaleBand().domain(regions).range([margin.top, height - margin.bottom]).padding(0.12);
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0.2, 1]);

    heatmapSvg.selectAll('*').remove();

    heatmapSvg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.time))
        .attr('y', d => y(d.region))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', d => color(d.engagement))
        .attr('stroke', d => d.time === recommendedEventHour ? '#0f172a' : 'none')
        .attr('stroke-width', d => d.time === recommendedEventHour ? 2 : 0)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 2);
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('background', 'white')
                .style('border', '1px solid #cbd5e1')
                .style('border-radius', '6px')
                .style('padding', '8px 10px')
                .style('pointer-events', 'none')
                .html(
                    `Time: ${formatLocalHourLabel(d.time)} ${EVENT_TIME_LABEL}<br>` +
                    `Region: ${regionConfigs[d.region].label}<br>` +
                    `Engagement: ${(d.engagement * 100).toFixed(0)}%<br>` +
                    `Audience: ${Math.round(d.audienceSize)}`
                );
            tooltip.style('left', `${event.pageX + 10}px`);
            tooltip.style('top', `${event.pageY - 10}px`);
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .attr('stroke', d.time === recommendedEventHour ? '#0f172a' : 'none')
                .attr('stroke-width', d.time === recommendedEventHour ? 2 : 0);
            d3.selectAll('.tooltip').remove();
        });

    heatmapSvg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => formatLocalHourLabel(d)));

    heatmapSvg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(region => regionConfigs[region].label));
}

function mapTimeZoneToRegion(timeZone) {
    if (timeZone.startsWith('America/')) {
        return 'NA';
    }

    if (timeZone.startsWith('Europe/') || timeZone.startsWith('Africa/') || timeZone.startsWith('Atlantic/')) {
        return 'EU';
    }

    return 'AS';
}

function getLocalHourForTimeZone(timeZone, eventHour) {
    const wholeHour = Math.floor(eventHour);
    const minutes = Math.round((eventHour - wholeHour) * 60);
    const date = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
        wholeHour,
        minutes,
        0,
    ));

    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const hourPart = formatted.find(part => part.type === 'hour');
    const minutePart = formatted.find(part => part.type === 'minute');
    return Number(hourPart.value) + Number(minutePart.value) / 60;
}

function isValidTimeZone(timeZone) {
    try {
        Intl.DateTimeFormat('en-US', { timeZone }).format(referenceDate);
        return true;
    } catch (error) {
        return false;
    }
}

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        const nextCharacter = line[index + 1];

        if (character === '"') {
            if (inQuotes && nextCharacter === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (character === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }

    cells.push(current.trim());
    return cells;
}

function normalizeHeader(header) {
    return header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeHour(hour) {
    return (hour + 24) % 24;
}

function circularDistance(hourA, hourB) {
    const distance = Math.abs(hourA - hourB);
    return Math.min(distance, 24 - distance);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatHourForInput(hour) {
    const localizedHour = getHourInEventTimeZone(hour);
    const normalized = normalizeHour(localizedHour);
    const wholeHour = Math.floor(normalized);
    const minutes = Math.round((normalized - wholeHour) * 60);
    return `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatLocalHourForInput(hour) {
    const normalized = normalizeHour(hour);
    const wholeHour = Math.floor(normalized);
    const minutes = Math.round((normalized - wholeHour) * 60);
    return `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function convertEventLocalHourToUtc(localHour) {
    return normalizeHour(localHour - getTimeZoneOffsetHours(EVENT_TIME_ZONE));
}

function getHourInEventTimeZone(utcHour) {
    return getLocalHourForTimeZone(EVENT_TIME_ZONE, utcHour);
}

function getTimeZoneOffsetHours(timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(referenceDate);

    const offsetLabel = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT+0';
    const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!match) {
        return 0;
    }

    const [, sign, hours, minutes = '00'] = match;
    const absoluteOffset = Number(hours) + (Number(minutes) / 60);
    return sign === '-' ? -absoluteOffset : absoluteOffset;
}

function formatLocalHourLabel(hour) {
    return `${String(Math.floor(normalizeHour(hour))).padStart(2, '0')}:00`;
}

refreshDashboard();



const ALLOWED_MAP_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'google.com',
  'maps.google.com',
]);

interface Coordinates {
  lat: number;
  lng: number;
}

function isAllowedMapsUrl(url: URL): boolean {
  return url.protocol === 'https:' && ALLOWED_MAP_HOSTS.has(url.hostname.toLowerCase());
}

function parseCoordinatePair(latText: string, lngText: string): Coordinates | null {
  const lat = Number(latText);
  const lng = Number(lngText);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function parseMapsCoordinates(value: string): Coordinates | null {
  const precisePin = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (precisePin) {
    const coordinates = parseCoordinatePair(precisePin[1], precisePin[2]);
    if (coordinates) return coordinates;
  }

  const viewport = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewport) {
    const coordinates = parseCoordinatePair(viewport[1], viewport[2]);
    if (coordinates) return coordinates;
  }

  const query = value.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (query) return parseCoordinatePair(query[1], query[2]);
  return null;
}

export async function POST(request: Request) {
  let inputUrl: URL;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('url' in body) ||
      typeof body.url !== 'string' ||
      body.url.length > 2048
    ) {
      return Response.json({ error: 'Provide a valid Google Maps URL.' }, { status: 400 });
    }
    inputUrl = new URL(body.url);
  } catch {
    return Response.json({ error: 'Provide a valid Google Maps URL.' }, { status: 400 });
  }

  if (!isAllowedMapsUrl(inputUrl)) {
    return Response.json({ error: 'Only supported Google Maps links are accepted.' }, { status: 400 });
  }

  const directCoordinates = parseMapsCoordinates(inputUrl.href);
  if (directCoordinates) {
    return Response.json({
      ...directCoordinates,
      expandedUrl: inputUrl.href,
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    let currentUrl = inputUrl;
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'LocalDealsHubMapsLinkResolver/1.0' },
      });
      if (response.status < 300 || response.status >= 400) break;

      const location = response.headers.get('location');
      if (!location || redirectCount === 5) {
        return Response.json({ error: 'This Maps link could not be expanded.' }, { status: 422 });
      }
      currentUrl = new URL(location, currentUrl);
      if (!isAllowedMapsUrl(currentUrl)) {
        return Response.json({ error: 'The Maps link redirected to an unsupported host.' }, { status: 400 });
      }
    }

    if (!response) {
      return Response.json({ error: 'This Maps link could not be expanded.' }, { status: 422 });
    }
    const pageText = `${currentUrl.href}\n${await response.text()}`;
    const coordinates = parseMapsCoordinates(pageText);
    if (!response.ok || !coordinates) {
      return Response.json(
        { error: 'Could not find precise shop coordinates in this Maps link. Try a Google Maps share link.' },
        { status: 422 }
      );
    }
    return Response.json({ ...coordinates, expandedUrl: currentUrl.href });
  } catch {
    return Response.json(
      { error: 'Could not expand this Maps link. Check the link or fine-tune the pin manually.' },
      { status: 422 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

import { Loader } from "@googlemaps/js-api-loader";

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function checkStreetViewCoverage(lat: number, lng: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!apiKey) return resolve(false);
    const sv = new google.maps.StreetViewService();
    sv.getPanorama(
      { location: { lat, lng }, radius: 100, preference: google.maps.StreetViewPreference.BEST },
      (data, status) => {
        resolve(status === google.maps.StreetViewStatus.OK && !!data?.location?.pano);
      }
    );
  });
}

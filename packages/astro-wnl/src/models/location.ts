/**
 * 地理位置（经纬度）
 */
export class Location {
  /** 经度（度），东正西负 */
  readonly longitude: number;

  /** 纬度（度），北正南负 */
  readonly latitude: number;

  constructor(longitude: number, latitude: number) {
    this.longitude = longitude;
    this.latitude = latitude;
  }

  /** 北京 */
  static readonly beijing = new Location(116.4074, 39.9042);

  /** 默认：东经120°，北纬30°（UTC+8 标准线） */
  static readonly defaultLoc = new Location(120, 30);

  toString(): string {
    return `Location(${this.longitude}, ${this.latitude})`;
  }
}

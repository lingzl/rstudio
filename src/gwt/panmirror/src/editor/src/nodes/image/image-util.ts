import { mathAppendMarkTransaction } from "../../marks/math/math-transaction";

/*
 * image-util.ts
 *
 * Copyright (C) 2019-20 by RStudio, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

const kDpi = 96;

// https://github.com/jgm/pandoc/blob/master/src/Text/Pandoc/ImageSize.hs
const kValidUnits = ["px", "in", "cm", "mm", "%"];// 

export function validUnits() {
  return kValidUnits;
}

export function isValidUnit(unit: string) {
  return kValidUnits.includes(unit);
}


export function isNaturalAspectRatio(width: number, height: number, img: HTMLImageElement) {
  if (img.naturalWidth && img.naturalHeight) {
    const diff = Math.abs((width/height) - (img.naturalWidth/img.naturalHeight));
    return diff <= 0.02;
  } else {
    // no naturalWidth or naturalHeight, assume it's natural (perhaps the image isn't loaded yet?)
    return true;
  }
}

export function unitToPixels(value: number, unit: string, containerWidth: number) {
  let pixels;
  switch(unit) {
    case "in":
      pixels = value * kDpi;
      break;
    case "mm":
      pixels = value * (kDpi / 25.4);
      break;
    case "cm":
      pixels = value * (kDpi / 2.54);
      break;
    case "%":
      pixels = (value / 100) * containerWidth;
      break;
    case "px":
    default:
      pixels = value;
      break;
  }
  return Math.round(pixels);
}

export function pixelsToUnit(pixels: number, unit: string, containerWidth: number) {
  switch(unit) {
    case "in":
      return pixels / kDpi;
    case "mm":
      return (pixels / kDpi) * 25.4;
    case "cm":
      return (pixels / kDpi) * 2.54;
    case "%":
      return (pixels / containerWidth) * 100;
    case "px":
    default:
      return pixels;
  }
}

export function roundUnit(value: number, unit: string)  {
  switch(unit) {
    case "in":
      return value.toFixed(2);
    case "cm":
      return value.toFixed(1);
    default:
      return Math.round(value).toString();
  }
}


export function sizePropToStyle(prop: string) {
  // if it's a number, append px
  if (/^\d*\.?\d*$/.test(prop)) {
    return prop + "px";
  } else {
    return prop;
  }
}

export function sizePropToStylePixels(prop: string, containerWidth: number) {
  const sizeWithUnits = sizePropWithUnit(prop);
  if (sizeWithUnits) {
    sizeWithUnits.unit = sizeWithUnits.unit || 'px';
    return unitToPixels(sizeWithUnits.size, sizeWithUnits.unit, containerWidth) + 'px';
  } else {
    return null;
  }
}

export function sizePropWithUnit(prop: string | null) {
  if (prop) {
    const match = prop.match(/(^\d*\.?\d*)(.*)$/);
    if (match) {
      return {
        size: parseFloat(match[1]),
        unit: match[2]
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
 
}

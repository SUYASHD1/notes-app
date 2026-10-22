// Media Block Model (Images & Animated GIFs)

export class MediaBlockModel {
  static computeDimensions(originalWidth, originalHeight, maxWidth = 600, maxHeight = 400) {
    if (!originalWidth || !originalHeight) {
      return { width: 300, height: 200 };
    }

    const aspect = originalWidth / originalHeight;
    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspect;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspect;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
      aspectRatio: aspect
    };
  }
}

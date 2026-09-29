// Cut subjects out with macOS Vision (local, no network).
//   cutout in.png out.png [all|largest|smallest]   → tight-cropped RGBA PNG
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: cutout in out.png [all|largest|smallest]"); exit(1) }
let mode = a.count > 3 ? a[3] : "all"
guard let img = CIImage(contentsOf: URL(fileURLWithPath: a[1])) else { print("cannot read", a[1]); exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: img)
try h.perform([req])
guard let r = req.results?.first, !r.allInstances.isEmpty else { print("no subject", a[1]); exit(2) }
var chosen = r.allInstances
if mode != "all" && r.allInstances.count > 1 {
  // area of each instance from its own mask
  var areas: [(Int, Int)] = []
  for i in r.allInstances {
    let m = try r.generateScaledMaskForImage(forInstances: IndexSet(integer: i), from: h)
    CVPixelBufferLockBaseAddress(m, .readOnly)
    let w = CVPixelBufferGetWidth(m), hh = CVPixelBufferGetHeight(m), bpr = CVPixelBufferGetBytesPerRow(m)
    let p = CVPixelBufferGetBaseAddress(m)!.assumingMemoryBound(to: Float32.self)
    var n = 0
    for y in stride(from: 0, to: hh, by: 4) { for x in stride(from: 0, to: w, by: 4) { if p[y * bpr / 4 + x] > 0.5 { n += 1 } } }
    CVPixelBufferUnlockBaseAddress(m, .readOnly)
    areas.append((i, n))
  }
  areas.sort { $0.1 < $1.1 }
  chosen = IndexSet(integer: mode == "smallest" ? areas.first!.0 : areas.last!.0)
}
let buf = try r.generateMaskedImage(ofInstances: chosen, from: h, croppedToInstancesExtent: true)
let out = CIImage(cvPixelBuffer: buf)
try CIContext().writePNGRepresentation(of: out, to: URL(fileURLWithPath: a[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("ok", a[2].split(separator: "/").last!, Int(out.extent.width), "x", Int(out.extent.height), "instances", r.allInstances.count, "mode", mode)

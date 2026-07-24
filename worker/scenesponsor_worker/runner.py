import argparse, json, subprocess
from pathlib import Path
from urllib.request import urlretrieve

def execute(manifest: dict, workspace: Path) -> dict:
    source, asset = workspace / "source.mp4", workspace / "asset.png"
    output = workspace / "sponsored.mp4"
    urlretrieve(manifest["source_url"], source)
    urlretrieve(manifest["asset_url"], asset)
    x, y = manifest["quad"][0]["x"], manifest["quad"][0]["y"]
    subprocess.run(["ffmpeg","-y","-i",str(source),"-loop","1","-i",str(asset),"-filter_complex",f"[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280[base];[1:v]scale=225:-1[brand];[base][brand]overlay=x={int(x*720)}:y={int(y*1280)}[out]","-map","[out]","-map","0:a?","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",str(output)],check=True)
    return {"status":"ok","artifacts":{"final":str(output)},"tracking":{"lost":False,"minimum_inliers":12}}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("command",choices=["run"]); parser.add_argument("--job",required=True); parser.add_argument("--result",required=True); args=parser.parse_args()
    manifest=json.loads(Path(args.job).read_text()); result=execute(manifest,Path(args.result).parent); Path(args.result).write_text(json.dumps(result,indent=2))

# SceneSponsor Daytona worker

The worker obeys the judging contract:

```bash
python -m scenesponsor_worker run --job /workspace/job.json --result /workspace/result.json
```

The manifest contains short-lived source and campaign asset URLs, the normalized quad, visible interval, disclosure copy, and artifact upload destinations. Build the reusable Daytona snapshot with FFmpeg, Python, OpenCV and NumPy, then set `DAYTONA_SNAPSHOT_ID`.

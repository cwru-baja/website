import subprocess, os, shutil
CAR="car_noframe_0031.png"; FRAME="frame_only_0031.png"; OUT="fh2"
BG="color=c=0x0d0d0f:s=960x540"   # dark page color, represents transparency on the site
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT,f))
N=14; MAXSIG=14.0
def comp(sig, alpha, path):
    sig=max(0.5,sig)
    subprocess.run(["ffmpeg","-y","-loglevel","error",
      "-f","lavfi","-i",BG,"-i",CAR,"-i",FRAME,
      "-filter_complex",
      f"[1]gblur=sigma={sig:.3f},colorchannelmixer=aa={alpha:.3f}[car];"
      f"[0][car]overlay[t];[t][2]overlay",
      "-frames:v","1",path],check=True)
idx=0
for _ in range(4):                      # sharp lead-in (full car)
    idx+=1; comp(0.5, 1.0, f"{OUT}/f_{idx:04d}.png")
for i in range(N+1):                    # OUT: non-frame blurs + fades to transparent
    p=i/N; idx+=1; comp(MAXSIG*p, 1-p, f"{OUT}/f_{idx:04d}.png")
last=f"{OUT}/f_{idx:04d}.png"
for _ in range(14):                     # HOLD: only the frame remains
    idx+=1; shutil.copy(last, f"{OUT}/f_{idx:04d}.png")
for i in range(N-1,-1,-1):              # IN: parts fade/sharpen back
    p=i/N; idx+=1; comp(MAXSIG*p, 1-p, f"{OUT}/f_{idx:04d}.png")
for _ in range(3):                      # sharp tail
    idx+=1; comp(0.5, 1.0, f"{OUT}/f_{idx:04d}.png")
print("frames:", idx)

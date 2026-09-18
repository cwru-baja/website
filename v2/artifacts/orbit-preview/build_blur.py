import subprocess, os
BASE="off/0031.png"; WHEEL="wheel_only_0031.png"; OUT="blur2"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT,f))
N=14; MAXSIG=18.0
def comp(sig, alpha, path):
    sig=max(0.5, sig)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",BASE,"-i",WHEEL,
        "-filter_complex",f"[1]gblur=sigma={sig:.3f},colorchannelmixer=aa={alpha:.3f}[w];[0][w]overlay",
        "-frames:v","1",path], check=True)
idx=0
# OUT: wheel blurs up + fades out
for i in range(N+1):
    p=i/N; idx+=1
    comp(MAXSIG*p, 1-p, f"{OUT}/f_{idx:04d}.png")
# HOLD on brakes
import shutil
for _ in range(10):
    idx+=1; shutil.copy(BASE, f"{OUT}/f_{idx:04d}.png")
# IN: reverse
for i in range(N-1,-1,-1):
    p=i/N; idx+=1
    comp(MAXSIG*p, 1-p, f"{OUT}/f_{idx:04d}.png")
print("frames:", idx)

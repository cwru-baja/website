import subprocess, os, shutil
BG="on/0031.png"; FG="frame_only_0031.png"; OUT="fh"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT,f))
N=14; MAXSIG=14.0
def comp(sig, alpha, path):
    sig=max(0.5,sig)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",BG,"-i",FG,
      "-filter_complex",
      f"[0]gblur=sigma={sig:.3f}[bg];[1]colorchannelmixer=aa={alpha:.3f}[fg];[bg][fg]overlay",
      "-frames:v","1",path],check=True)
idx=0
# small sharp lead-in
for _ in range(4):
    idx+=1; shutil.copy(BG, f"{OUT}/f_{idx:04d}.png")
# OUT: background blurs up, sharp frame fades in on top
for i in range(N+1):
    p=i/N; idx+=1; comp(MAXSIG*p, p, f"{OUT}/f_{idx:04d}.png")
# HOLD on frame-focused look
last=f"{OUT}/f_{idx:04d}.png"
for _ in range(14):
    idx+=1; shutil.copy(last, f"{OUT}/f_{idx:04d}.png")
# IN: back to sharp full car
for i in range(N-1,-1,-1):
    p=i/N; idx+=1; comp(MAXSIG*p, p, f"{OUT}/f_{idx:04d}.png")
# small sharp tail
for _ in range(3):
    idx+=1; shutil.copy(BG, f"{OUT}/f_{idx:04d}.png")
print("frame-highlight frames:", idx)

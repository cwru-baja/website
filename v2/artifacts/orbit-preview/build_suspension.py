import subprocess, os, shutil
def run(a): subprocess.run(a, check=True)
CK="checker.png"
BASE="nowheels_0111.png"           # car intact, all four wheels removed (sharp)
WHEEL="wheels_0111.png"            # all four wheels only
MASK="mask_wheels_0111.png"        # occlusion-correct visible region
OUT="sb"
os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT+"/"+f)
N=14; SIG=18.0

def comp(sig, alpha, path):
    """all four wheels blur + fade away; rest of the car stays sharp"""
    sig=max(0.5,sig)
    fg=(f"[2]gblur=sigma={sig:.3f},format=rgba,split[w1][w2];"
        f"[w1]alphaextract[wa];"
        f"[3]alphaextract[mk];"
        f"[wa][mk]blend=all_mode=multiply,format=gray[wam];"
        f"[w2][wam]alphamerge,colorchannelmixer=aa={alpha:.3f}[wl];"
        f"[0][1]overlay[b];[b][wl]overlay")
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",CK,"-i",BASE,"-i",WHEEL,"-i",MASK,
         "-filter_complex",fg,"-frames:v","1",path])

idx=0
def nxt():
    global idx
    idx+=1
    return f"{OUT}/f_{idx:04d}.png"

for _ in range(4): comp(0.5,1.0,nxt())                    # full car, sharp
for i in range(N+1): p=i/N; comp(SIG*p,1-p,nxt())         # front wheels dissolve
last=f"{OUT}/f_{idx:04d}.png"
for _ in range(14): idx+=1; shutil.copy(last,f"{OUT}/f_{idx:04d}.png")   # hold on front suspension
for i in range(N-1,-1,-1): p=i/N; comp(SIG*p,1-p,nxt())   # wheels return
for _ in range(3): comp(0.5,1.0,nxt())                    # sharp tail
run(["ffmpeg","-y","-loglevel","error","-framerate","24","-start_number","1","-i",f"{OUT}/f_%04d.png",
     "-c:v","libx264","-pix_fmt","yuv420p","-r","24","-crf","18","suspension_isolate.mp4"])
print("frames:", idx)

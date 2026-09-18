import subprocess, os, shutil
def run(a): subprocess.run(a, check=True)
CK="checker.png"; BASE="keep_only_0076.png"; FULL="on_t/0076.png"; MASK="mask_keep_0076.png"
FLY="sw_fly"; OUT="eb"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT+"/"+f)
N=14; SIG=14.0

def dissolve(sig, invp, path):
    """car blurs+fades; steering wheel stays sharp, occlusion-correct"""
    sig=max(0.5,sig)
    fg=(f"[2]split[ts][tbl];"
        f"[3]alphaextract,split[mk1][mk2];"
        f"[ts][mk1]alphamerge[sf];"
        f"[mk2]negate[inv];"
        f"[tbl]gblur=sigma={sig:.3f},format=rgba,split[tb1][tb2];"
        f"[tb1]alphaextract[ta];"
        f"[ta][inv]blend=all_mode=multiply,format=gray[amul];"
        f"[tb2][amul]alphamerge,colorchannelmixer=aa={invp:.3f}[fd];"
        f"[0][1]overlay[c1];[c1][fd]overlay[c2];[c2][sf]overlay")
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",CK,"-i",BASE,"-i",FULL,"-i",MASK,
         "-filter_complex",fg,"-frames:v","1",path])

def flyframe(src, path):
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",CK,"-i",src,
         "-filter_complex","[0][1]overlay","-frames:v","1",path])

idx=0
def nxt(): 
    global idx
    idx+=1
    return f"{OUT}/f_{idx:04d}.png"

for _ in range(4): dissolve(0.5,1.0,nxt())                      # sharp full car
for i in range(N+1): p=i/N; dissolve(SIG*p,1-p,nxt())           # car dissolves, wheel remains
nfly=len(sorted(os.listdir(FLY)))
for i in range(1,nfly+1): flyframe(f"{FLY}/{i:04d}.png", nxt()) # wheel flies out + grows
hero=f"{OUT}/f_{idx:04d}.png"
for _ in range(12): idx+=1; shutil.copy(hero, f"{OUT}/f_{idx:04d}.png")   # hold close-up
for i in range(nfly-1,0,-1): flyframe(f"{FLY}/{i:04d}.png", nxt())        # flies back
for i in range(N-1,-1,-1): p=i/N; dissolve(SIG*p,1-p,nxt())     # car blurs back in
for _ in range(3): dissolve(0.5,1.0,nxt())                      # sharp tail
run(["ffmpeg","-y","-loglevel","error","-framerate","24","-start_number","1","-i",f"{OUT}/f_%04d.png",
     "-c:v","libx264","-pix_fmt","yuv420p","-r","24","-crf","18","electronics_isolate.mp4"])
print("frames:", idx)

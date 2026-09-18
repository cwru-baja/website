import subprocess, os, shutil
def run(a): subprocess.run(a, check=True)
CK="checker.png"; BASE="keep_only_0061.png"; FULL="on_t/0061.png"; MASK="mask_keep_0061.png"
OUT="db"; os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT): os.remove(OUT+"/"+f)
N=14; SIG=14.0
def comp(sig,invp,path):
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
idx=0
for _ in range(4): idx+=1; comp(0.5,1.0,f"{OUT}/f_{idx:04d}.png")      # sharp lead-in (full car)
for i in range(N+1): p=i/N; idx+=1; comp(SIG*p,1-p,f"{OUT}/f_{idx:04d}.png")  # OUT
last=f"{OUT}/f_{idx:04d}.png"
for _ in range(14): idx+=1; shutil.copy(last,f"{OUT}/f_{idx:04d}.png")  # HOLD on driveline
for i in range(N-1,-1,-1): p=i/N; idx+=1; comp(SIG*p,1-p,f"{OUT}/f_{idx:04d}.png")  # IN
for _ in range(3): idx+=1; comp(0.5,1.0,f"{OUT}/f_{idx:04d}.png")      # tail
run(["ffmpeg","-y","-loglevel","error","-framerate","24","-start_number","1","-i",f"{OUT}/f_%04d.png",
     "-c:v","libx264","-pix_fmt","yuv420p","-r","24","-crf","18","drivetrain_isolate.mp4"])
print("frames:",idx)

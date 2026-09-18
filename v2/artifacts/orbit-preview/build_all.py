import subprocess, os, shutil
def run(args): subprocess.run(args, check=True)
CK="checker.png"

# ---------- rotation segments (transparent orbit over checker) ----------
def rot(start, count, outfile):
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-framerate","24","-i",CK,
         "-framerate","24","-start_number",str(start),"-i","on_t/%04d.png",
         "-filter_complex","[0][1]overlay=shortest=1:format=auto",
         "-frames:v",str(count),"-r","24","-pix_fmt","yuv420p","-crf","18",outfile])
rot(1,31,"s_in.mp4")     # 1..31   front -> side
rot(31,31,"s_mid.mp4")   # 31..61  side  -> back
rot(61,16,"s_e.mp4")     # 61..76  back  -> electronics angle
rot(76,36,"s_s.mp4")     # 76..111 -> front 3/4 (suspension)
rot(111,10,"s_out.mp4")  # 111..120 -> front

# ---------- tire beat over checker ----------
# base = off_t/0031 (brakes, sharp) ; wheel_only blurs+fades
os.makedirs("tb",exist_ok=True)
for f in os.listdir("tb"): os.remove("tb/"+f)
N=14; SIG=18.0; idx=0
def tire(sig,alpha,path):
    sig=max(0.5,sig)
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",CK,
         "-i","off_t/0031.png","-i","wheel_only_0031.png","-filter_complex",
         f"[0][1]overlay[b];[2]gblur=sigma={sig:.3f},colorchannelmixer=aa={alpha:.3f}[w];[b][w]overlay",
         "-frames:v","1",path])
for i in range(N+1):
    p=i/N; idx+=1; tire(SIG*p,1-p,f"tb/f_{idx:04d}.png")
last=f"tb/f_{idx:04d}.png"
for _ in range(10):
    idx+=1; shutil.copy(last,f"tb/f_{idx:04d}.png")
for i in range(N-1,-1,-1):
    p=i/N; idx+=1; tire(SIG*p,1-p,f"tb/f_{idx:04d}.png")
run(["ffmpeg","-y","-loglevel","error","-framerate","24","-start_number","1","-i","tb/f_%04d.png",
     "-c:v","libx264","-pix_fmt","yuv420p","-r","24","-crf","18","tire.mp4"])

# ---------- frame isolate beat over checker ----------
# car_noframe blurs+fades to transparent ; frame_only stays sharp
os.makedirs("fb",exist_ok=True)
for f in os.listdir("fb"): os.remove("fb/"+f)
N=14; SIG=14.0; idx=0
def frame(sig,invp,path):
    # depth-ordered: full frame (back) -> body parts blur+fade (middle) -> sharp visible cage (top)
    sig=max(0.5,sig)
    # fading alpha = on_t.alpha * inv_mask * invp  (so empty bg + frame region stay clear)
    fg=(f"[2]split[ts][tbl];"
        f"[3]alphaextract,split[mk1][mk2];"
        f"[ts][mk1]alphamerge[sf];"
        f"[mk2]negate[inv];"
        f"[tbl]gblur=sigma={sig:.3f},format=rgba,split[tb1][tb2];"
        f"[tb1]alphaextract[ta];"
        f"[ta][inv]blend=all_mode=multiply,format=gray[amul];"
        f"[tb2][amul]alphamerge,colorchannelmixer=aa={invp:.3f}[fd];"
        f"[0][1]overlay[c1];[c1][fd]overlay[c2];[c2][sf]overlay")
    run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",CK,
         "-i","frame_only_0031.png","-i","on_t/0031.png","-i","mask_render_0031.png",
         "-filter_complex",fg,"-frames:v","1",path])
for _ in range(4):
    idx+=1; frame(0.5,1.0,f"fb/f_{idx:04d}.png")
for i in range(N+1):
    p=i/N; idx+=1; frame(SIG*p,1-p,f"fb/f_{idx:04d}.png")
last=f"fb/f_{idx:04d}.png"
for _ in range(14):
    idx+=1; shutil.copy(last,f"fb/f_{idx:04d}.png")
for i in range(N-1,-1,-1):
    p=i/N; idx+=1; frame(SIG*p,1-p,f"fb/f_{idx:04d}.png")
for _ in range(3):
    idx+=1; frame(0.5,1.0,f"fb/f_{idx:04d}.png")
run(["ffmpeg","-y","-loglevel","error","-framerate","24","-start_number","1","-i","fb/f_%04d.png",
     "-c:v","libx264","-pix_fmt","yuv420p","-r","24","-crf","18","frame_isolate.mp4"])

# ---------- concat full ----------
with open("seq.txt","w") as fh:
    for s in ["s_in.mp4","tire.mp4","frame_isolate.mp4",
              "s_mid.mp4","drivetrain_isolate.mp4",
              "s_e.mp4","electronics_isolate.mp4",
              "s_s.mp4","suspension_isolate.mp4","s_out.mp4"]:
        fh.write(f"file '{s}'\n")
run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i","seq.txt","-c","copy","full_sequence.mp4"])
print("done")

"use client";

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto py-8 px-4 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <h3 className="text-lg font-extrabold tracking-tight text-brand">Sri Srinivasa</h3>
            <p className="text-sm text-muted-foreground">
              Premium enterprise transport solutions for KIA Motors and
              sub-companies across Andhra Pradesh.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Employee Transport</li>
              <li>Corporate Cars</li>
              <li>Tempo Travellers</li>
              <li>Truck Logistics</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>About Us</li>
              <li>Careers</li>
              <li>Contact</li>
              <li>Privacy Policy</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Operations: +91 98765 43210</li>
              <li>Support: support@transport.com</li>
              <li>Anantapur, Andhra Pradesh</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Sri Srinivasa Secure Logistics. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
